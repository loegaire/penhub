export type ChallengeType = "web" | "crypto" | "pwn" | "rev" | "misc" | "cloud" | "unknown"

export type Challenge = {
  id: string
  name: string
  type: ChallengeType
  goal: string
  workspacePath: string
  createdAt: string
}

export type Fact = {
  id: string
  source: "source" | "runtime" | "tool" | "model" | "manual"
  claim: string
  confidence: number
  evidenceIds: string[]
  branchId?: string
  hypothesisId?: string
  createdAt: string
}

export type HypothesisStatus = "open" | "testing" | "confirmed" | "failed" | "stale"

export type Hypothesis = {
  id: string
  claim: string
  status: HypothesisStatus
  requiredEvidence: string[]
  nextTest?: string
  confidence: number
  branchId?: string
  createdAt: string
  updatedAt: string
}

export type BranchStatus = "open" | "active" | "blocked" | "confirmed" | "failed" | "stale"

export type Branch = {
  id: string
  goal: string
  status: BranchStatus
  confidence: number
  progress: number
  novelty: number
  tokenCost: number
  repetitionPenalty: number
  evidenceIds: string[]
  hypothesisIds: string[]
  createdAt: string
  updatedAt: string
}

export type Evidence = {
  id: string
  type: "file" | "http" | "log" | "runtime" | "diff" | "flag" | "manual"
  summary: string
  artifactPath?: string
  hash?: string
  supports: string[]
  branchId?: string
  hypothesisId?: string
  createdAt: string
}

export type FailedAttempt = {
  id: string
  summary: string
  reason: string
  branchId?: string
  hypothesisId?: string
  actionId?: string
  createdAt: string
}

export type TokenUsage = {
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  byBranch: Record<string, number>
  byAction: Record<string, number>
  byHypothesis: Record<string, number>
  compressionRatio?: number
}

export type WorkspaceState = {
  challenge: Challenge
  facts: Fact[]
  hypotheses: Hypothesis[]
  branches: Branch[]
  evidence: Evidence[]
  failedAttempts: FailedAttempt[]
  tokenUsage: TokenUsage
}

export type StateFilter = {
  id?: string
  status?: string | string[]
  branchId?: string
  hypothesisId?: string
  actionId?: string
  evidenceId?: string
  limit?: number
}

export type PlannerDecision =
  | {
      type: "continue"
      branch: Branch
      reason: string
    }
  | {
      type: "stop"
      reason: string
    }

export const emptyTokenUsage = (): TokenUsage => ({
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalTokens: 0,
  byBranch: {},
  byAction: {},
  byHypothesis: {},
})
