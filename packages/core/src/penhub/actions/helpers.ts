import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { compressObservation } from "../observation"
import type { PenHubActionContext } from "../action-runtime"

export type TreeEntry = {
  path: string
  type: "file" | "dir"
  size?: number
}

const ignoredDirectories = new Set([".git", ".penhub", "node_modules", ".turbo", "dist", "build", "coverage"])
const textExtensions = new Set([
  ".c",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
])

export function resolveInsideWorkspace(workspacePath: string, requested = ".") {
  const workspaceRoot = path.resolve(workspacePath)
  const candidate = path.resolve(path.isAbsolute(requested) ? requested : path.join(workspaceRoot, requested))
  if (candidate !== workspaceRoot && !candidate.startsWith(workspaceRoot + path.sep)) {
    throw new Error(`PenHub action path escapes workspace: ${requested}`)
  }
  return candidate
}

export function relativeWorkspacePath(workspacePath: string, filePath: string) {
  const relative = path.relative(path.resolve(workspacePath), filePath)
  return relative.length ? relative.split(path.sep).join("/") : "."
}

export async function walkWorkspaceEntries(input: {
  workspacePath: string
  rootPath?: string
  includeHidden?: boolean
  maxEntries: number
  filesOnly?: boolean
}) {
  const root = resolveInsideWorkspace(input.workspacePath, input.rootPath)
  const entries: TreeEntry[] = []
  let truncated = false

  async function visit(directory: string) {
    if (entries.length >= input.maxEntries) {
      truncated = true
      return
    }
    const children = await readdir(directory, { withFileTypes: true })
    for (const child of children.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entries.length >= input.maxEntries) {
        truncated = true
        return
      }
      if (!input.includeHidden && child.name.startsWith(".")) continue
      if (child.isDirectory() && ignoredDirectories.has(child.name)) continue
      const fullPath = path.join(directory, child.name)
      if (child.isSymbolicLink()) continue
      if (child.isDirectory()) {
        if (!input.filesOnly) entries.push({ path: relativeWorkspacePath(input.workspacePath, fullPath), type: "dir" })
        await visit(fullPath)
        continue
      }
      if (!child.isFile()) continue
      const fileStat = await stat(fullPath)
      entries.push({ path: relativeWorkspacePath(input.workspacePath, fullPath), type: "file", size: fileStat.size })
    }
  }

  await visit(root)
  return { entries, truncated }
}

export async function listTextFiles(input: {
  workspacePath: string
  rootPath?: string
  maxFiles: number
  paths?: string[]
}) {
  if (input.paths?.length) {
    return input.paths
      .map((item) => resolveInsideWorkspace(input.workspacePath, item))
      .filter((item) => textExtensions.has(path.extname(item).toLowerCase()))
  }

  const { entries } = await walkWorkspaceEntries({
    workspacePath: input.workspacePath,
    rootPath: input.rootPath,
    maxEntries: input.maxFiles,
    filesOnly: true,
  })
  return entries
    .filter((entry) => entry.type === "file")
    .map((entry) => resolveInsideWorkspace(input.workspacePath, entry.path))
    .filter((item) => textExtensions.has(path.extname(item).toLowerCase()))
}

export async function readTextPreview(filePath: string, maxBytes: number) {
  const raw = await readFile(filePath, "utf8")
  return {
    text: raw.slice(0, maxBytes),
    bytes: Buffer.byteLength(raw),
    lines: raw.length ? raw.split(/\r?\n/).length : 0,
    truncated: Buffer.byteLength(raw) > maxBytes,
  }
}

export async function compressActionOutput(context: PenHubActionContext, rawOutput: string) {
  const observation = await compressObservation({
    workspacePath: context.workspacePath,
    rawOutput,
    idGenerator: context.idGenerator,
    maxInlineChars: context.maxInlineChars ?? 2_000,
    maxSummaryChars: context.maxSummaryChars ?? 1_000,
  })
  return {
    compressedSummary: observation.compressedSummary,
    ...(observation.rawOutputPath ? { artifactPath: observation.rawOutputPath } : {}),
  }
}

export function assertLocalHttpUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`PenHub network action requires http(s) URL: ${value}`)
  }
  const hostname = url.hostname.toLowerCase()
  const local =
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.startsWith("127.")
  if (!local) {
    throw new Error(`PenHub network action only allows local targets: ${value}`)
  }
  return url
}

export function headersToRecord(headers: Headers) {
  const output: Record<string, string> = {}
  headers.forEach((value, key) => {
    output[key] = value
  })
  return output
}

export function firstNonEmptyLine(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)
}
