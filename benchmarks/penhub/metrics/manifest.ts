import path from "node:path"

export type BenchmarkMilestone = {
  id: string
  kind: "tool-call" | "transcript-pattern" | "candidate" | "oracle"
  tool?: string
  pattern?: string
}

export type BenchmarkCaseManifest = {
  id: string
  category: string
  promptFile: string
  workspace: string
  setup?: string[]
  teardown?: string[]
  oracle: string[]
  resultPattern: string
  wallTimeSeconds: number
  outputTokenLimit?: number
  maxAttempts: number
  milestones: BenchmarkMilestone[]
}

export function parseBenchmarkCaseManifest(input: unknown): BenchmarkCaseManifest {
  const record = asRecord(input, "case manifest")
  return {
    id: asString(record.id, "id"),
    category: asString(record.category, "category"),
    promptFile: asString(record.promptFile, "promptFile"),
    workspace: asString(record.workspace, "workspace"),
    ...(record.setup === undefined ? {} : { setup: asCommand(record.setup, "setup") }),
    ...(record.teardown === undefined ? {} : { teardown: asCommand(record.teardown, "teardown") }),
    oracle: asCommand(record.oracle, "oracle"),
    resultPattern: asPattern(record.resultPattern, "resultPattern"),
    wallTimeSeconds: asPositiveNumber(record.wallTimeSeconds, "wallTimeSeconds"),
    ...(record.outputTokenLimit === undefined
      ? {}
      : { outputTokenLimit: asPositiveNumber(record.outputTokenLimit, "outputTokenLimit") }),
    maxAttempts: asPositiveNumber(record.maxAttempts, "maxAttempts"),
    milestones: asMilestones(record.milestones),
  }
}

export function resolveCasePaths(casePath: string, manifest: BenchmarkCaseManifest) {
  const root = path.dirname(path.resolve(casePath))
  const workspace = path.resolve(root, manifest.workspace)
  const prompt = path.resolve(workspace, manifest.promptFile)
  if (!workspace.startsWith(`${root}${path.sep}`)) throw new Error("Benchmark workspace must stay inside the case root")
  if (!prompt.startsWith(`${workspace}${path.sep}`)) throw new Error("Benchmark prompt must stay inside the workspace")
  return { root, workspace, prompt }
}

function asRecord(input: unknown, label: string): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`Invalid ${label}: expected object`)
  return input
}

function asString(input: unknown, label: string) {
  if (typeof input !== "string" || input.length === 0) throw new Error(`Invalid case manifest ${label}`)
  return input
}

function asPositiveNumber(input: unknown, label: string) {
  if (typeof input !== "number" || !Number.isInteger(input) || input <= 0) {
    throw new Error(`Invalid case manifest ${label}`)
  }
  return input
}

function asCommand(input: unknown, label: string) {
  if (!Array.isArray(input) || input.length === 0 || !input.every((item) => typeof item === "string" && item.length)) {
    throw new Error(`Invalid case manifest ${label}`)
  }
  return input
}

function asMilestones(input: unknown) {
  if (!Array.isArray(input)) throw new Error("Invalid case manifest milestones")
  return input.map((item) => {
    const record = asRecord(item, "milestone")
    const kind = record.kind
    if (kind !== "tool-call" && kind !== "transcript-pattern" && kind !== "candidate" && kind !== "oracle") {
      throw new Error("Invalid case manifest milestone kind")
    }
    if (kind === "transcript-pattern" && typeof record.pattern !== "string") {
      throw new Error("Transcript milestone requires a pattern")
    }
    if (kind === "tool-call" && record.tool !== undefined && typeof record.tool !== "string") {
      throw new Error("Tool-call milestone requires a tool name")
    }
    return {
      id: asString(record.id, "milestone id"),
      kind,
      ...(record.tool === undefined ? {} : { tool: asString(record.tool, "milestone tool") }),
      ...(record.pattern === undefined ? {} : { pattern: asString(record.pattern, "milestone pattern") }),
    } satisfies BenchmarkMilestone
  })
}

function asPattern(input: unknown, label: string) {
  const pattern = asString(input, label)
  new RegExp(pattern)
  return pattern
}
