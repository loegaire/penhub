export * as PenHubRunState from "./state"

import { Schema } from "effect"
import { NonNegativeInt, PositiveInt } from "../../schema"

export const BranchStatus = Schema.Literals(["queued", "active", "supported", "refuted", "blocked"])
export type BranchStatus = typeof BranchStatus.Type

export const Branch = Schema.Struct({
  id: Schema.String,
  claim: Schema.String,
  nextTest: Schema.String,
  expectedSignal: Schema.String,
  status: BranchStatus,
  attempts: NonNegativeInt,
  reflectionRetries: NonNegativeInt,
  createdAt: Schema.String,
  updatedAt: Schema.String,
})
export type Branch = typeof Branch.Type

export const AttemptStatus = Schema.Literals(["success", "error", "timeout"])
export type AttemptStatus = typeof AttemptStatus.Type

export const Attempt = Schema.Struct({
  id: Schema.String,
  sessionId: Schema.String,
  callId: Schema.String,
  branchId: Schema.String.pipe(Schema.optional),
  tool: Schema.String,
  normalizedArgsHash: Schema.String,
  status: AttemptStatus,
  observation: Schema.String,
  observationHash: Schema.String,
  artifactPath: Schema.String.pipe(Schema.optional),
  startedAt: Schema.String,
  finishedAt: Schema.String,
  durationMs: NonNegativeInt,
  outputBytes: NonNegativeInt,
})
export type Attempt = typeof Attempt.Type

export const Lesson = Schema.Struct({
  id: Schema.String,
  branchId: Schema.String,
  attemptIds: Schema.Array(Schema.String),
  failedAssumption: Schema.String,
  validObservations: Schema.Array(Schema.String),
  avoid: Schema.String,
  nextTest: Schema.String,
  createdAt: Schema.String,
})
export type Lesson = typeof Lesson.Type

export const VerifiedFinding = Schema.Struct({
  id: Schema.String,
  claim: Schema.String,
  candidate: Schema.String,
  verificationMethod: Schema.String,
  artifactPaths: Schema.Array(Schema.String),
  verifiedAt: Schema.String,
})
export type VerifiedFinding = typeof VerifiedFinding.Type

export const RunState = Schema.Struct({
  version: Schema.Literal(1),
  goal: Schema.String,
  sessionId: Schema.String,
  phase: Schema.Literals(["plan", "act", "verify", "reflect", "complete"]),
  activeBranchId: Schema.String.pipe(Schema.optional),
  reflectionPendingBranchId: Schema.String.pipe(Schema.optional),
  milestoneIds: Schema.Array(Schema.String),
  attemptCount: NonNegativeInt,
  providerTurns: NonNegativeInt,
  tokenCount: NonNegativeInt,
  lastDecisionAttemptCount: NonNegativeInt,
  noProgressTurns: NonNegativeInt,
  status: Schema.Literals(["active", "solved", "blocked", "budget-exhausted"]),
  branches: Schema.Array(Branch),
  findings: Schema.Array(VerifiedFinding),
  budgets: Schema.Struct({
    maxAttempts: PositiveInt,
    maxProviderTurns: PositiveInt,
    maxTokens: PositiveInt.pipe(Schema.optional),
  }),
  finalResponsePending: Schema.Boolean,
  createdAt: Schema.String,
  updatedAt: Schema.String,
})
export type RunState = typeof RunState.Type
