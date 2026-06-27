import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { z } from "zod/v4"
import { captureEvidence } from "../action-runtime/evidence-recorder"
import type { PenHubActionManifest } from "../action-runtime/types"
import { generateMarkdownReport } from "../report/markdown-report"
import { FileAttackStateStore } from "../state-store"
import {
  assertLocalHttpUrl,
  compressActionOutput,
  firstNonEmptyLine,
  headersToRecord,
  listTextFiles,
  readTextPreview,
  relativeWorkspacePath,
  resolveInsideWorkspace,
  walkWorkspaceEntries,
} from "./helpers"

const compactOutput = z.object({
  compressedSummary: z.string(),
  artifactPath: z.string().optional(),
})

const inspectTreeInput = z.object({
  rootPath: z.string().default("."),
  maxEntries: z.number().int().min(1).max(1_000).default(120),
  includeHidden: z.boolean().default(false),
})

const inspectTreeOutput = compactOutput.extend({
  files: z.array(z.object({ path: z.string(), type: z.enum(["file", "dir"]), size: z.number().optional() })),
  truncated: z.boolean(),
})

const summarizeFilesInput = z.object({
  paths: z.array(z.string()).min(1).max(50),
  maxBytesPerFile: z.number().int().min(100).max(20_000).default(4_000),
})

const summarizeFilesOutput = compactOutput.extend({
  files: z.array(
    z.object({
      path: z.string(),
      bytes: z.number(),
      lines: z.number(),
      preview: z.string(),
      truncated: z.boolean(),
    }),
  ),
})

const scanFilesInput = z.object({
  rootPath: z.string().default("."),
  paths: z.array(z.string()).max(100).optional(),
  maxFiles: z.number().int().min(1).max(1_000).default(200),
})

const extractRoutesOutput = compactOutput.extend({
  routes: z.array(z.object({ method: z.string().optional(), path: z.string(), source: z.string() })),
})

const extractInputsOutput = compactOutput.extend({
  inputs: z.array(z.object({ name: z.string(), kind: z.string(), source: z.string() })),
})

const extractSinksOutput = compactOutput.extend({
  sinks: z.array(z.object({ kind: z.string(), severity: z.string(), source: z.string(), snippet: z.string() })),
})

const runLocalAppInput = z.object({
  command: z.array(z.string()).min(1).max(20),
  cwd: z.string().default("."),
  timeoutMs: z.number().int().min(100).max(30_000).default(5_000),
})

const runLocalAppOutput = compactOutput.extend({
  exitCode: z.number().nullable(),
  signal: z.string().nullable(),
})

const sendRequestInput = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.string().optional(),
  timeoutMs: z.number().int().min(100).max(30_000).default(5_000),
})

const sendRequestOutput = compactOutput.extend({
  status: z.number(),
  contentType: z.string().optional(),
  bodyPreview: z.string(),
  headers: z.record(z.string(), z.string()),
})

const responseInput = z.object({
  label: z.string().default("response"),
  status: z.number().optional(),
  body: z.string(),
})

const compareResponsesInput = z.object({
  left: responseInput,
  right: responseInput,
})

const compareResponsesOutput = compactOutput.extend({
  sameStatus: z.boolean(),
  lengthDelta: z.number(),
  commonPrefixChars: z.number(),
})

const inspectLogsInput = z.object({
  paths: z.array(z.string()).min(1).max(50),
  pattern: z.string().optional(),
  maxLines: z.number().int().min(1).max(500).default(50),
})

const inspectLogsOutput = compactOutput.extend({
  matches: z.array(z.object({ path: z.string(), line: z.number(), text: z.string() })),
})

const recordEvidenceInput = z.object({
  type: z.enum(["file", "http", "log", "runtime", "diff", "flag", "manual"]),
  summary: z.string().min(1),
  rawContent: z.string().optional(),
  artifactPath: z.string().optional(),
  artifactName: z.string().optional(),
  supports: z.array(z.string()).default([]),
  branchId: z.string().optional(),
  hypothesisId: z.string().optional(),
})

const recordEvidenceOutput = compactOutput.extend({
  evidenceId: z.string(),
  hash: z.string().optional(),
})

const updateHypothesisInput = z.object({
  id: z.string(),
  status: z.enum(["open", "testing", "confirmed", "failed", "stale"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  nextTest: z.string().optional(),
  requiredEvidence: z.array(z.string()).optional(),
})

const updateHypothesisOutput = compactOutput.extend({
  hypothesisId: z.string(),
  status: z.string(),
})

const generateReportInput = z.object({
  outputPath: z.string().optional(),
})

const generateReportOutput = compactOutput.extend({
  reportPath: z.string(),
})

const dirFuzzInput = z.object({
  baseUrl: z.string().url(),
  words: z.array(z.string()).min(1).max(200),
  timeoutMs: z.number().int().min(100).max(30_000).default(3_000),
  maxHits: z.number().int().min(1).max(100).default(50),
})

const dirFuzzOutput = compactOutput.extend({
  hits: z.array(z.object({ url: z.string(), status: z.number(), length: z.number() })),
})

export const inspectTreeAction = defineAction({
  name: "inspect_tree",
  description: "List a compact workspace tree without reading file contents.",
  riskLevel: "read-only",
  inputSchema: inspectTreeInput,
  outputSchema: inspectTreeOutput,
  async run(input, context) {
    const { entries, truncated } = await walkWorkspaceEntries({
      workspacePath: context.workspacePath,
      rootPath: input.rootPath,
      includeHidden: input.includeHidden,
      maxEntries: input.maxEntries,
    })
    const rawOutput = entries
      .map((entry) => `${entry.type.padEnd(4)} ${entry.path}${entry.size ? ` ${entry.size}b` : ""}`)
      .join("\n")
    return {
      ...(await compressActionOutput(context, rawOutput || "No files found.")),
      files: entries,
      truncated,
    }
  },
})

export const summarizeFilesAction = defineAction({
  name: "summarize_files",
  description: "Read selected workspace files and return short previews plus line/byte counts.",
  riskLevel: "read-only",
  inputSchema: summarizeFilesInput,
  outputSchema: summarizeFilesOutput,
  async run(input, context) {
    const files = []
    for (const item of input.paths) {
      const filePath = resolveInsideWorkspace(context.workspacePath, item)
      const preview = await readTextPreview(filePath, input.maxBytesPerFile)
      files.push({
        path: relativeWorkspacePath(context.workspacePath, filePath),
        bytes: preview.bytes,
        lines: preview.lines,
        preview: preview.text,
        truncated: preview.truncated,
      })
    }
    const rawOutput = files
      .map((file) => `${file.path}: ${file.lines} lines, ${file.bytes} bytes\n${file.preview}`)
      .join("\n\n")
    return {
      ...(await compressActionOutput(context, rawOutput)),
      files,
    }
  },
})

export const extractRoutesAction = defineAction({
  name: "extract_routes",
  description: "Extract route-like paths from common web framework source files.",
  riskLevel: "read-only",
  inputSchema: scanFilesInput,
  outputSchema: extractRoutesOutput,
  async run(input, context) {
    const files = await listTextFiles({
      workspacePath: context.workspacePath,
      rootPath: input.rootPath,
      maxFiles: input.maxFiles,
      paths: input.paths,
    })
    const routes = []
    for (const filePath of files) {
      const source = await readFile(filePath, "utf8")
      const relative = relativeWorkspacePath(context.workspacePath, filePath)
      for (const match of source.matchAll(
        /\b(?:app|router)\.(get|post|put|delete|patch|head)\(\s*["'`]([^"'`]+)["'`]/gi,
      )) {
        routes.push({ method: match[1]?.toUpperCase(), path: match[2] ?? "/", source: relative })
      }
      for (const match of source.matchAll(/@\s*(Get|Post|Put|Delete|Patch)\(\s*["'`]([^"'`]+)["'`]/g)) {
        routes.push({ method: match[1]?.toUpperCase(), path: match[2] ?? "/", source: relative })
      }
      for (const match of source.matchAll(/\b(?:href|action)=["'`]([^"'`#][^"'`]*)["'`]/gi)) {
        routes.push({ path: match[1] ?? "/", source: relative })
      }
    }
    const rawOutput = routes.map((route) => `${route.method ?? "ANY"} ${route.path} (${route.source})`).join("\n")
    return {
      ...(await compressActionOutput(context, rawOutput || "No route-like paths found.")),
      routes,
    }
  },
})

export const extractInputsAction = defineAction({
  name: "extract_inputs",
  description: "Extract likely user-controlled inputs from source files.",
  riskLevel: "read-only",
  inputSchema: scanFilesInput,
  outputSchema: extractInputsOutput,
  async run(input, context) {
    const files = await listTextFiles({
      workspacePath: context.workspacePath,
      rootPath: input.rootPath,
      maxFiles: input.maxFiles,
      paths: input.paths,
    })
    const inputs = []
    for (const filePath of files) {
      const source = await readFile(filePath, "utf8")
      const relative = relativeWorkspacePath(context.workspacePath, filePath)
      for (const match of source.matchAll(/<input\b[^>]*\bname=["'`]([^"'`]+)["'`]/gi)) {
        inputs.push({ name: match[1] ?? "input", kind: "html-input", source: relative })
      }
      for (const match of source.matchAll(/\breq\.(body|query|params)\.([a-zA-Z0-9_$]+)/g)) {
        inputs.push({ name: match[2] ?? "field", kind: `request-${match[1]}`, source: relative })
      }
      for (const match of source.matchAll(/\bprocess\.env\.([a-zA-Z0-9_]+)/g)) {
        inputs.push({ name: match[1] ?? "ENV", kind: "environment", source: relative })
      }
    }
    const rawOutput = inputs.map((item) => `${item.kind} ${item.name} (${item.source})`).join("\n")
    return {
      ...(await compressActionOutput(context, rawOutput || "No likely inputs found.")),
      inputs,
    }
  },
})

export const extractSinksAction = defineAction({
  name: "extract_sinks",
  description: "Extract risky sink patterns for manual review without executing payloads.",
  riskLevel: "read-only",
  inputSchema: scanFilesInput,
  outputSchema: extractSinksOutput,
  async run(input, context) {
    const files = await listTextFiles({
      workspacePath: context.workspacePath,
      rootPath: input.rootPath,
      maxFiles: input.maxFiles,
      paths: input.paths,
    })
    const patterns = [
      { kind: "command-exec", severity: "high", regex: /\b(exec|spawn|system|popen)\s*\(/ },
      { kind: "dynamic-code", severity: "high", regex: /\b(eval|Function)\s*\(/ },
      { kind: "html-injection", severity: "medium", regex: /\binnerHTML\b/ },
      { kind: "sql-string", severity: "medium", regex: /\bSELECT\b.+(\$\{|%s|\+)/i },
      { kind: "deserialization", severity: "high", regex: /\b(pickle\.loads|yaml\.load|unserialize)\s*\(/ },
    ]
    const sinks = []
    for (const filePath of files) {
      const source = await readFile(filePath, "utf8")
      const relative = relativeWorkspacePath(context.workspacePath, filePath)
      const lines = source.split(/\r?\n/)
      for (const [index, line] of lines.entries()) {
        for (const pattern of patterns) {
          if (!pattern.regex.test(line)) continue
          sinks.push({
            kind: pattern.kind,
            severity: pattern.severity,
            source: `${relative}:${index + 1}`,
            snippet: line.trim().slice(0, 180),
          })
        }
      }
    }
    const rawOutput = sinks.map((sink) => `${sink.severity} ${sink.kind} ${sink.source}: ${sink.snippet}`).join("\n")
    return {
      ...(await compressActionOutput(context, rawOutput || "No risky sink patterns found.")),
      sinks,
    }
  },
})

export const runLocalAppAction = defineAction({
  name: "run_local_app",
  description: "Run a short local command without shell expansion and summarize stdout/stderr.",
  riskLevel: "local-exec",
  inputSchema: runLocalAppInput,
  outputSchema: runLocalAppOutput,
  async run(input, context) {
    const cwd = resolveInsideWorkspace(context.workspacePath, input.cwd)
    const result = await runCommand(input.command, cwd, input.timeoutMs)
    const rawOutput = [`$ ${input.command.join(" ")}`, result.stdout, result.stderr].filter(Boolean).join("\n")
    return {
      ...(await compressActionOutput(context, rawOutput)),
      exitCode: result.exitCode,
      signal: result.signal,
    }
  },
})

export const sendRequestAction = defineAction({
  name: "send_request",
  description: "Send a local HTTP request and return compact status/header/body preview.",
  riskLevel: "network-local",
  inputSchema: sendRequestInput,
  outputSchema: sendRequestOutput,
  async run(input, context) {
    assertLocalHttpUrl(input.url)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs)
    try {
      const response = await fetch(input.url, {
        method: input.method,
        headers: input.headers,
        body: input.body,
        signal: controller.signal,
      })
      const body = await response.text()
      const headers = headersToRecord(response.headers)
      const rawOutput = [`HTTP ${response.status}`, JSON.stringify(headers, null, 2), "", body].join("\n")
      return {
        ...(await compressActionOutput(context, rawOutput)),
        status: response.status,
        ...(headers["content-type"] ? { contentType: headers["content-type"] } : {}),
        bodyPreview: body.replace(/\s+/g, " ").trim().slice(0, 500),
        headers,
      }
    } finally {
      clearTimeout(timeout)
    }
  },
})

export const compareResponsesAction = defineAction({
  name: "compare_responses",
  description: "Compare two short response bodies for status, length, and common prefix deltas.",
  riskLevel: "read-only",
  inputSchema: compareResponsesInput,
  outputSchema: compareResponsesOutput,
  async run(input, context) {
    const commonPrefixChars = countCommonPrefix(input.left.body, input.right.body)
    const sameStatus = input.left.status === input.right.status
    const lengthDelta = input.right.body.length - input.left.body.length
    const rawOutput = [
      `${input.left.label}: status=${input.left.status ?? "unknown"} length=${input.left.body.length}`,
      `${input.right.label}: status=${input.right.status ?? "unknown"} length=${input.right.body.length}`,
      `sameStatus=${sameStatus} lengthDelta=${lengthDelta} commonPrefixChars=${commonPrefixChars}`,
    ].join("\n")
    return {
      ...(await compressActionOutput(context, rawOutput)),
      sameStatus,
      lengthDelta,
      commonPrefixChars,
    }
  },
})

export const inspectLogsAction = defineAction({
  name: "inspect_logs",
  description: "Inspect selected log files and return matching lines only.",
  riskLevel: "read-only",
  inputSchema: inspectLogsInput,
  outputSchema: inspectLogsOutput,
  async run(input, context) {
    const pattern = input.pattern ? new RegExp(input.pattern, "i") : undefined
    const matches = []
    for (const item of input.paths) {
      const filePath = resolveInsideWorkspace(context.workspacePath, item)
      const lines = (await readFile(filePath, "utf8")).split(/\r?\n/)
      for (const [index, line] of lines.entries()) {
        if (matches.length >= input.maxLines) break
        if (pattern && !pattern.test(line)) continue
        if (!pattern && line.trim().length === 0) continue
        matches.push({
          path: relativeWorkspacePath(context.workspacePath, filePath),
          line: index + 1,
          text: line.slice(0, 300),
        })
      }
    }
    const rawOutput = matches.map((match) => `${match.path}:${match.line}: ${match.text}`).join("\n")
    return {
      ...(await compressActionOutput(context, rawOutput || "No matching log lines found.")),
      matches,
    }
  },
})

export const recordEvidenceAction = defineAction({
  name: "record_evidence",
  description: "Capture evidence, optionally writing raw content to an artifact with SHA-256 hash.",
  riskLevel: "manual",
  inputSchema: recordEvidenceInput,
  outputSchema: recordEvidenceOutput,
  async run(input, context) {
    const evidence = await captureEvidence({
      workspacePath: context.workspacePath,
      type: input.type,
      summary: input.summary,
      rawContent: input.rawContent,
      artifactPath: input.artifactPath,
      artifactName: input.artifactName,
      supports: input.supports,
      branchId: input.branchId,
      hypothesisId: input.hypothesisId,
      createdAt: context.now?.(),
      idGenerator: context.idGenerator,
    })
    return {
      compressedSummary: `Recorded evidence ${evidence.id}: ${evidence.summary}`,
      evidenceId: evidence.id,
      ...(evidence.artifactPath ? { artifactPath: evidence.artifactPath } : {}),
      ...(evidence.hash ? { hash: evidence.hash } : {}),
    }
  },
})

export const updateHypothesisAction = defineAction({
  name: "update_hypothesis",
  description: "Patch a hypothesis status, confidence, next test, or required evidence.",
  riskLevel: "manual",
  inputSchema: updateHypothesisInput,
  outputSchema: updateHypothesisOutput,
  async run(input, context) {
    const store = new FileAttackStateStore(context.workspacePath)
    const [current] = await store.listHypotheses({ id: input.id })
    if (!current) throw new Error(`PenHub hypothesis not found: ${input.id}`)
    const updatedAt = context.now?.() ?? new Date().toISOString()
    await store.updateHypothesis(input.id, {
      ...(input.status ? { status: input.status } : {}),
      ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
      ...(input.nextTest !== undefined ? { nextTest: input.nextTest } : {}),
      ...(input.requiredEvidence ? { requiredEvidence: input.requiredEvidence } : {}),
      updatedAt,
    })
    const [updated] = await store.listHypotheses({ id: input.id })
    if (!updated) throw new Error(`PenHub hypothesis not found after update: ${input.id}`)
    return {
      compressedSummary: `Updated hypothesis ${updated.id}: ${updated.status} (${updated.confidence})`,
      hypothesisId: updated.id,
      status: updated.status,
    }
  },
})

export const generateReportAction = defineAction({
  name: "generate_report",
  description: "Generate a Markdown report from structured PenHub state and evidence.",
  riskLevel: "manual",
  inputSchema: generateReportInput,
  outputSchema: generateReportOutput,
  async run(input, context) {
    const report = await generateMarkdownReport({
      workspacePath: context.workspacePath,
      outputPath: input.outputPath,
    })
    return {
      compressedSummary: `Generated PenHub report at ${report.reportPath}`,
      reportPath: report.reportPath,
    }
  },
})

export const dirFuzzAction = defineAction({
  name: "dir_fuzz",
  description: "Probe a small wordlist against a local base URL and return compact hits.",
  riskLevel: "network-local",
  inputSchema: dirFuzzInput,
  outputSchema: dirFuzzOutput,
  async run(input, context) {
    const baseUrl = assertLocalHttpUrl(input.baseUrl)
    const hits = []
    for (const word of input.words) {
      if (hits.length >= input.maxHits) break
      const target = new URL(word.replace(/^\/+/, ""), ensureTrailingSlash(baseUrl).toString())
      assertLocalHttpUrl(target.toString())
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), input.timeoutMs)
      try {
        const response = await fetch(target, { signal: controller.signal })
        const body = await response.text()
        if (response.status < 400) hits.push({ url: target.toString(), status: response.status, length: body.length })
      } catch {
        // Ignore individual word failures; the compact result should describe only useful hits.
      } finally {
        clearTimeout(timeout)
      }
    }
    const rawOutput = hits.map((hit) => `${hit.status} ${hit.length} ${hit.url}`).join("\n")
    return {
      ...(await compressActionOutput(context, rawOutput || "No directory fuzz hits found.")),
      hits,
    }
  },
})

export const builtInPenHubActions = [
  inspectTreeAction,
  summarizeFilesAction,
  extractRoutesAction,
  extractInputsAction,
  extractSinksAction,
  runLocalAppAction,
  sendRequestAction,
  compareResponsesAction,
  inspectLogsAction,
  recordEvidenceAction,
  updateHypothesisAction,
  generateReportAction,
  dirFuzzAction,
].map((action) => action as PenHubActionManifest<unknown, unknown>)

function defineAction<Input, Output>(action: PenHubActionManifest<Input, Output>) {
  return action
}

function runCommand(command: string[], cwd: string, timeoutMs: number) {
  return new Promise<{ stdout: string; stderr: string; exitCode: number | null; signal: string | null }>(
    (resolve, reject) => {
      const child = spawn(command[0], command.slice(1), { cwd, shell: false })
      let stdout = ""
      let stderr = ""
      const timeout = setTimeout(() => child.kill("SIGTERM"), timeoutMs)
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk)
      })
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk)
      })
      child.on("error", (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      child.on("close", (exitCode, signal) => {
        clearTimeout(timeout)
        resolve({ stdout, stderr, exitCode, signal })
      })
    },
  )
}

function countCommonPrefix(left: string, right: string) {
  let index = 0
  while (index < left.length && index < right.length && left[index] === right[index]) index++
  return index
}

function ensureTrailingSlash(url: URL) {
  const next = new URL(url.toString())
  if (!next.pathname.endsWith("/")) next.pathname += "/"
  return next
}

export function summarizeFindingSource(filePath: string, text: string) {
  const firstLine = firstNonEmptyLine(text)
  return firstLine ? `${path.basename(filePath)}: ${firstLine}` : path.basename(filePath)
}
