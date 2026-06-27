export type BenchmarkRunner = "opencode-baseline" | "penhub"

export type BenchmarkRunResult = {
  runner: BenchmarkRunner
  caseId: string
  model: string
  startedAt: string
  finishedAt: string
  success: boolean
  flagFound: boolean
  flag?: string
  timeToFlagSeconds?: number
  totalTokens?: number
  toolCallsCount: number
  repeatedActionsCount: number
  failedBranchCount?: number
  humanInterventionsCount: number
  evidenceItemsCount?: number
  reportGenerated: boolean
  reportReplayabilityScore?: number
  notes?: string[]
  isSampleData: boolean
}

export type BenchmarkComparison = {
  caseId: string
  model: string
  baseline: BenchmarkRunResult
  penhub: BenchmarkRunResult
  deltas: {
    tokens?: number
    timeSeconds?: number
    toolCalls: number
    repeatedActions: number
    humanInterventions: number
  }
  conclusion: string
  isSampleData: boolean
}

export function parseBenchmarkRunResult(input: unknown): BenchmarkRunResult {
  const record = asRecord(input, "benchmark run")
  return {
    runner: asBenchmarkRunner(record.runner),
    caseId: asString(record.caseId, "caseId"),
    model: asString(record.model, "model"),
    startedAt: asString(record.startedAt, "startedAt"),
    finishedAt: asString(record.finishedAt, "finishedAt"),
    success: asBoolean(record.success, "success"),
    flagFound: asBoolean(record.flagFound, "flagFound"),
    ...(record.flag === undefined ? {} : { flag: asString(record.flag, "flag") }),
    ...(record.timeToFlagSeconds === undefined
      ? {}
      : { timeToFlagSeconds: asNumber(record.timeToFlagSeconds, "timeToFlagSeconds") }),
    ...(record.totalTokens === undefined ? {} : { totalTokens: asNumber(record.totalTokens, "totalTokens") }),
    toolCallsCount: asNumber(record.toolCallsCount, "toolCallsCount"),
    repeatedActionsCount: asNumber(record.repeatedActionsCount, "repeatedActionsCount"),
    ...(record.failedBranchCount === undefined
      ? {}
      : { failedBranchCount: asNumber(record.failedBranchCount, "failedBranchCount") }),
    humanInterventionsCount: asNumber(record.humanInterventionsCount, "humanInterventionsCount"),
    ...(record.evidenceItemsCount === undefined
      ? {}
      : { evidenceItemsCount: asNumber(record.evidenceItemsCount, "evidenceItemsCount") }),
    reportGenerated: asBoolean(record.reportGenerated, "reportGenerated"),
    ...(record.reportReplayabilityScore === undefined
      ? {}
      : { reportReplayabilityScore: asNumber(record.reportReplayabilityScore, "reportReplayabilityScore") }),
    ...(record.notes === undefined ? {} : { notes: asStringArray(record.notes, "notes") }),
    isSampleData: asBoolean(record.isSampleData, "isSampleData"),
  }
}

function asRecord(input: unknown, label: string): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`Invalid ${label}: expected object`)
  return input
}

function asBenchmarkRunner(input: unknown): BenchmarkRunner {
  if (input === "opencode-baseline" || input === "penhub") return input
  throw new Error("Invalid benchmark runner")
}

function asString(input: unknown, label: string) {
  if (typeof input !== "string" || input.length === 0)
    throw new Error(`Invalid benchmark run ${label}: expected string`)
  return input
}

function asBoolean(input: unknown, label: string) {
  if (typeof input !== "boolean") throw new Error(`Invalid benchmark run ${label}: expected boolean`)
  return input
}

function asNumber(input: unknown, label: string) {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    throw new Error(`Invalid benchmark run ${label}: expected finite number`)
  }
  return input
}

function asStringArray(input: unknown, label: string) {
  if (!Array.isArray(input) || !input.every((item) => typeof item === "string")) {
    throw new Error(`Invalid benchmark run ${label}: expected string array`)
  }
  return input
}
