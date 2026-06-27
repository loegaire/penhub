import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Branch, Challenge, Evidence, Fact, FailedAttempt, Hypothesis } from "@opencode-ai/core/penhub/index"

export async function tempWorkspace() {
  return mkdtemp(path.join(tmpdir(), "penhub-"))
}

export function challenge(workspacePath: string): Challenge {
  return {
    id: "challenge_test",
    name: "PenHub Test",
    type: "web",
    goal: "Exercise PenHub state.",
    workspacePath,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
}

export function fact(overrides: Partial<Fact> = {}): Fact {
  return {
    id: "fact_test",
    source: "manual",
    claim: "A compact fact exists.",
    confidence: 0.9,
    evidenceIds: ["ev_test"],
    createdAt: "2026-01-01T00:01:00.000Z",
    ...overrides,
  }
}

export function hypothesis(overrides: Partial<Hypothesis> = {}): Hypothesis {
  return {
    id: "hyp_test",
    claim: "A hypothesis exists.",
    status: "open",
    requiredEvidence: [],
    confidence: 0.5,
    createdAt: "2026-01-01T00:01:00.000Z",
    updatedAt: "2026-01-01T00:01:00.000Z",
    ...overrides,
  }
}

export function branch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: "br_test",
    goal: "Explore branch.",
    status: "open",
    confidence: 0.6,
    progress: 0.4,
    novelty: 0.7,
    tokenCost: 1_000,
    repetitionPenalty: 0.1,
    evidenceIds: [],
    hypothesisIds: [],
    createdAt: "2026-01-01T00:01:00.000Z",
    updatedAt: "2026-01-01T00:01:00.000Z",
    ...overrides,
  }
}

export function evidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: "ev_test",
    type: "manual",
    summary: "Evidence summary.",
    supports: [],
    createdAt: "2026-01-01T00:01:00.000Z",
    ...overrides,
  }
}

export function failedAttempt(overrides: Partial<FailedAttempt> = {}): FailedAttempt {
  return {
    id: "fail_test",
    summary: "An attempted exploit path failed.",
    reason: "The endpoint returned a fixed 404 response.",
    branchId: "br_test",
    actionId: "http_probe",
    createdAt: "2026-01-01T00:02:00.000Z",
    ...overrides,
  }
}
