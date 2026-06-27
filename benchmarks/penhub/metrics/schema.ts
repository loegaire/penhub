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
