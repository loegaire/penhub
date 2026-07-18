export type BenchmarkRunner = "opencode-baseline" | "penhub"

export type BenchmarkRunResult = {
  runner: BenchmarkRunner
  caseId: string
  model: string
  modelVariant?: string
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
  trial?: number
  harnessRevision?: string
  caseRevision?: string
  sessionId?: string
  oraclePassed?: boolean
  replaySuccess?: boolean
  highestMilestone?: string
  milestones?: string[]
  inputTokens?: number
  outputTokens?: number
  reasoningTokens?: number
  toolErrorsCount?: number
  actionFingerprints?: string[]
  artifactPaths?: string[]
  tracePath?: string
  exitCode?: number
  timedOut?: boolean
  observations?: Record<string, unknown>
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
    ...(record.modelVariant === undefined ? {} : { modelVariant: asString(record.modelVariant, "modelVariant") }),
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
    ...(record.trial === undefined ? {} : { trial: asNumber(record.trial, "trial") }),
    ...(record.harnessRevision === undefined
      ? {}
      : { harnessRevision: asString(record.harnessRevision, "harnessRevision") }),
    ...(record.caseRevision === undefined ? {} : { caseRevision: asString(record.caseRevision, "caseRevision") }),
    ...(record.sessionId === undefined ? {} : { sessionId: asString(record.sessionId, "sessionId") }),
    ...(record.oraclePassed === undefined ? {} : { oraclePassed: asBoolean(record.oraclePassed, "oraclePassed") }),
    ...(record.replaySuccess === undefined ? {} : { replaySuccess: asBoolean(record.replaySuccess, "replaySuccess") }),
    ...(record.highestMilestone === undefined
      ? {}
      : { highestMilestone: asString(record.highestMilestone, "highestMilestone") }),
    ...(record.milestones === undefined ? {} : { milestones: asStringArray(record.milestones, "milestones") }),
    ...(record.inputTokens === undefined ? {} : { inputTokens: asNumber(record.inputTokens, "inputTokens") }),
    ...(record.outputTokens === undefined ? {} : { outputTokens: asNumber(record.outputTokens, "outputTokens") }),
    ...(record.reasoningTokens === undefined
      ? {}
      : { reasoningTokens: asNumber(record.reasoningTokens, "reasoningTokens") }),
    ...(record.toolErrorsCount === undefined
      ? {}
      : { toolErrorsCount: asNumber(record.toolErrorsCount, "toolErrorsCount") }),
    ...(record.actionFingerprints === undefined
      ? {}
      : { actionFingerprints: asStringArray(record.actionFingerprints, "actionFingerprints") }),
    ...(record.artifactPaths === undefined
      ? {}
      : { artifactPaths: asStringArray(record.artifactPaths, "artifactPaths") }),
    ...(record.tracePath === undefined ? {} : { tracePath: asString(record.tracePath, "tracePath") }),
    ...(record.exitCode === undefined ? {} : { exitCode: asNumber(record.exitCode, "exitCode") }),
    ...(record.timedOut === undefined ? {} : { timedOut: asBoolean(record.timedOut, "timedOut") }),
    ...(record.observations === undefined ? {} : { observations: asRecord(record.observations, "observations") }),
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
