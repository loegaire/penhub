import {
  emptyTokenUsage,
  type Branch,
  type Challenge,
  type ChallengeType,
  type Evidence,
  type Fact,
  type FailedAttempt,
  type Hypothesis,
  type HypothesisStatus,
  type TokenUsage,
} from "./types"

export function normalizeTokenUsage(value: unknown): TokenUsage {
  const usage = isObject(value) ? { ...emptyTokenUsage(), ...value } : value
  assertTokenUsage(usage)
  return usage
}

const challengeTypes: readonly ChallengeType[] = ["web", "crypto", "pwn", "rev", "misc", "cloud", "unknown"]
const factSources: readonly Fact["source"][] = ["source", "runtime", "tool", "model", "manual"]
const hypothesisStatuses: readonly HypothesisStatus[] = ["open", "testing", "confirmed", "failed", "stale"]
const branchStatuses: readonly Branch["status"][] = ["open", "active", "blocked", "confirmed", "failed", "stale"]
const evidenceTypes: readonly Evidence["type"][] = ["file", "http", "log", "runtime", "diff", "flag", "manual"]

export function assertChallenge(value: unknown): asserts value is Challenge {
  const entity = "PenHub challenge"
  assertObject(value, entity)
  assertNonEmptyString(value.id, "id", entity)
  assertNonEmptyString(value.name, "name", entity)
  assertEnum(value.type, challengeTypes, "type", entity)
  assertNonEmptyString(value.goal, "goal", entity)
  assertNonEmptyString(value.workspacePath, "workspacePath", entity)
  assertTimestamp(value.createdAt, "createdAt", entity)
}

export function assertFact(value: unknown): asserts value is Fact {
  const entity = "PenHub fact"
  assertObject(value, entity)
  assertNonEmptyString(value.id, "id", entity)
  assertEnum(value.source, factSources, "source", entity)
  assertNonEmptyString(value.claim, "claim", entity)
  assertRatio(value.confidence, "confidence", entity)
  assertStringArray(value.evidenceIds, "evidenceIds", entity)
  assertOptionalNonEmptyString(value.branchId, "branchId", entity)
  assertOptionalNonEmptyString(value.hypothesisId, "hypothesisId", entity)
  assertTimestamp(value.createdAt, "createdAt", entity)
}

export function assertHypothesis(value: unknown): asserts value is Hypothesis {
  const entity = "PenHub hypothesis"
  assertObject(value, entity)
  assertNonEmptyString(value.id, "id", entity)
  assertNonEmptyString(value.claim, "claim", entity)
  assertEnum(value.status, hypothesisStatuses, "status", entity)
  assertStringArray(value.requiredEvidence, "requiredEvidence", entity)
  assertOptionalNonEmptyString(value.nextTest, "nextTest", entity)
  assertRatio(value.confidence, "confidence", entity)
  assertOptionalNonEmptyString(value.branchId, "branchId", entity)
  assertTimestamp(value.createdAt, "createdAt", entity)
  assertTimestamp(value.updatedAt, "updatedAt", entity)
}

export function assertBranch(value: unknown): asserts value is Branch {
  const entity = "PenHub branch"
  assertObject(value, entity)
  assertNonEmptyString(value.id, "id", entity)
  assertNonEmptyString(value.goal, "goal", entity)
  assertEnum(value.status, branchStatuses, "status", entity)
  assertRatio(value.confidence, "confidence", entity)
  assertRatio(value.progress, "progress", entity)
  assertRatio(value.novelty, "novelty", entity)
  assertNonNegativeNumber(value.tokenCost, "tokenCost", entity)
  assertRatio(value.repetitionPenalty, "repetitionPenalty", entity)
  assertStringArray(value.evidenceIds, "evidenceIds", entity)
  assertStringArray(value.hypothesisIds, "hypothesisIds", entity)
  assertTimestamp(value.createdAt, "createdAt", entity)
  assertTimestamp(value.updatedAt, "updatedAt", entity)
}

export function assertEvidence(value: unknown): asserts value is Evidence {
  const entity = "PenHub evidence"
  assertObject(value, entity)
  assertNonEmptyString(value.id, "id", entity)
  assertEnum(value.type, evidenceTypes, "type", entity)
  assertNonEmptyString(value.summary, "summary", entity)
  assertOptionalNonEmptyString(value.artifactPath, "artifactPath", entity)
  assertOptionalNonEmptyString(value.hash, "hash", entity)
  assertStringArray(value.supports, "supports", entity)
  assertOptionalNonEmptyString(value.branchId, "branchId", entity)
  assertOptionalNonEmptyString(value.hypothesisId, "hypothesisId", entity)
  assertTimestamp(value.createdAt, "createdAt", entity)
}

export function assertFailedAttempt(value: unknown): asserts value is FailedAttempt {
  const entity = "PenHub failed attempt"
  assertObject(value, entity)
  assertNonEmptyString(value.id, "id", entity)
  assertNonEmptyString(value.summary, "summary", entity)
  assertNonEmptyString(value.reason, "reason", entity)
  assertOptionalNonEmptyString(value.branchId, "branchId", entity)
  assertOptionalNonEmptyString(value.hypothesisId, "hypothesisId", entity)
  assertOptionalNonEmptyString(value.actionId, "actionId", entity)
  assertTimestamp(value.createdAt, "createdAt", entity)
}

export function assertTokenUsage(value: unknown): asserts value is TokenUsage {
  const entity = "PenHub token usage"
  assertObject(value, entity)
  assertNonNegativeNumber(value.totalInputTokens, "totalInputTokens", entity)
  assertNonNegativeNumber(value.totalOutputTokens, "totalOutputTokens", entity)
  assertNonNegativeNumber(value.totalTokens, "totalTokens", entity)
  assertNumberRecord(value.byBranch, "byBranch", entity)
  assertNumberRecord(value.byAction, "byAction", entity)
  assertNumberRecord(value.byHypothesis, "byHypothesis", entity)
  if (value.compressionRatio !== undefined) assertNonNegativeNumber(value.compressionRatio, "compressionRatio", entity)
}

function assertObject(value: unknown, entity: string): asserts value is Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(`Invalid ${entity}: expected object`)
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function assertNonEmptyString(value: unknown, field: string, entity: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${entity}: ${field} is required`)
  }
}

function assertOptionalNonEmptyString(
  value: unknown,
  field: string,
  entity: string,
): asserts value is string | undefined {
  if (value === undefined) return
  assertNonEmptyString(value, field, entity)
}

function assertTimestamp(value: unknown, field: string, entity: string): asserts value is string {
  assertNonEmptyString(value, field, entity)
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`Invalid ${entity}: ${field} must be a valid timestamp`)
  }
}

function assertEnum(
  value: unknown,
  allowed: readonly string[],
  field: string,
  entity: string,
): asserts value is string {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(`Invalid ${entity}: ${field} must be one of ${allowed.join(", ")}`)
  }
}

function assertNonNegativeNumber(value: unknown, field: string, entity: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${entity}: ${field} must be a non-negative number`)
  }
}

function assertRatio(value: unknown, field: string, entity: string): asserts value is number {
  assertNonNegativeNumber(value, field, entity)
  if (value > 1) {
    throw new Error(`Invalid ${entity}: ${field} must be between 0 and 1`)
  }
}

function assertStringArray(value: unknown, field: string, entity: string): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${entity}: ${field} must be an array`)
  }
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error(`Invalid ${entity}: ${field}[${index}] must be a non-empty string`)
    }
  }
}

function assertNumberRecord(value: unknown, field: string, entity: string): asserts value is Record<string, number> {
  assertObject(value, `${entity} ${field}`)
  for (const [key, amount] of Object.entries(value)) {
    if (key.trim().length === 0) {
      throw new Error(`Invalid ${entity}: ${field} contains an empty key`)
    }
    assertNonNegativeNumber(amount, `${field}.${key}`, entity)
  }
}
