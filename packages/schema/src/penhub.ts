export * as PenHub from "./penhub"

import { Schema } from "effect"
import { optional } from "./schema"

export const ToolPackID = Schema.Literals(["web", "browser", "audit", "binary", "forensics", "crypto"])
export type ToolPackID = typeof ToolPackID.Type

export interface ToolInfo extends Schema.Schema.Type<typeof ToolInfo> {}
export const ToolInfo = Schema.Struct({
  name: Schema.String,
  command: Schema.String,
  description: Schema.String,
})

export interface ToolPackInfo extends Schema.Schema.Type<typeof ToolPackInfo> {}
export const ToolPackInfo = Schema.Struct({
  id: ToolPackID,
  description: Schema.String,
  image: Schema.String,
  digest: Schema.String.pipe(optional),
  platforms: Schema.Array(Schema.Literals(["linux/amd64", "linux/arm64"])),
  installed: Schema.Boolean,
  tools: Schema.Array(ToolInfo),
})

export interface PullResult extends Schema.Schema.Type<typeof PullResult> {}
export const PullResult = Schema.Struct({
  pack: ToolPackID,
  runtime: Schema.Literals(["docker", "podman"]),
  image: Schema.String,
  output: Schema.String,
})

export const LiteLLMStart = Schema.Struct({
  configPath: Schema.String,
})

export const LiteLLMStatus = Schema.Struct({
  state: Schema.Literals(["stopped", "starting", "ready", "error"]),
  baseURL: Schema.String,
  configPath: Schema.String.pipe(optional),
  executable: Schema.String.pipe(optional),
  pid: Schema.Number.pipe(optional),
  message: Schema.String.pipe(optional),
})

const Challenge = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  type: Schema.Literals(["web", "crypto", "pwn", "rev", "misc", "cloud", "unknown"]),
  goal: Schema.String,
  workspacePath: Schema.String,
  createdAt: Schema.String,
})

const Fact = Schema.Struct({
  id: Schema.String,
  source: Schema.Literals(["source", "runtime", "tool", "model", "manual"]),
  claim: Schema.String,
  confidence: Schema.Number,
  evidenceIds: Schema.Array(Schema.String),
  branchId: Schema.String.pipe(optional),
  hypothesisId: Schema.String.pipe(optional),
  createdAt: Schema.String,
})

const Hypothesis = Schema.Struct({
  id: Schema.String,
  claim: Schema.String,
  status: Schema.Literals(["open", "testing", "confirmed", "failed", "stale"]),
  requiredEvidence: Schema.Array(Schema.String),
  nextTest: Schema.String.pipe(optional),
  confidence: Schema.Number,
  branchId: Schema.String.pipe(optional),
  createdAt: Schema.String,
  updatedAt: Schema.String,
})

const Branch = Schema.Struct({
  id: Schema.String,
  goal: Schema.String,
  status: Schema.Literals(["open", "active", "blocked", "confirmed", "failed", "stale"]),
  confidence: Schema.Number,
  progress: Schema.Number,
  novelty: Schema.Number,
  tokenCost: Schema.Number,
  repetitionPenalty: Schema.Number,
  evidenceIds: Schema.Array(Schema.String),
  hypothesisIds: Schema.Array(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
})

const Evidence = Schema.Struct({
  id: Schema.String,
  type: Schema.Literals(["file", "http", "log", "runtime", "diff", "flag", "manual"]),
  summary: Schema.String,
  artifactPath: Schema.String.pipe(optional),
  hash: Schema.String.pipe(optional),
  supports: Schema.Array(Schema.String),
  branchId: Schema.String.pipe(optional),
  hypothesisId: Schema.String.pipe(optional),
  createdAt: Schema.String,
})

const FailedAttempt = Schema.Struct({
  id: Schema.String,
  summary: Schema.String,
  reason: Schema.String,
  branchId: Schema.String.pipe(optional),
  hypothesisId: Schema.String.pipe(optional),
  actionId: Schema.String.pipe(optional),
  createdAt: Schema.String,
})

const TokenUsage = Schema.Struct({
  totalInputTokens: Schema.Number,
  totalOutputTokens: Schema.Number,
  totalTokens: Schema.Number,
  byBranch: Schema.Record(Schema.String, Schema.Number),
  byAction: Schema.Record(Schema.String, Schema.Number),
  byHypothesis: Schema.Record(Schema.String, Schema.Number),
  compressionRatio: Schema.Number.pipe(optional),
})

export interface WorkspaceState extends Schema.Schema.Type<typeof WorkspaceState> {}
export const WorkspaceState = Schema.Struct({
  challenge: Challenge,
  facts: Schema.Array(Fact),
  hypotheses: Schema.Array(Hypothesis),
  branches: Schema.Array(Branch),
  evidence: Schema.Array(Evidence),
  failedAttempts: Schema.Array(FailedAttempt),
  tokenUsage: TokenUsage,
})

export interface StateSnapshot extends Schema.Schema.Type<typeof StateSnapshot> {}
export const StateSnapshot = Schema.Struct({
  initialized: Schema.Boolean,
  workspace: WorkspaceState.pipe(optional),
  reportMarkdown: Schema.String.pipe(optional),
})

export interface ReportResult extends Schema.Schema.Type<typeof ReportResult> {}
export const ReportResult = Schema.Struct({
  path: Schema.String,
  markdown: Schema.String,
})
