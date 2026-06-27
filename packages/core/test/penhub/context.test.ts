import { describe, expect, test } from "bun:test"
import { buildStateCard, emptyTokenUsage, FileAttackStateStore, renderStateCard } from "@opencode-ai/core/penhub/index"
import { branch, challenge, evidence, fact, failedAttempt, hypothesis, tempWorkspace } from "./helper"

describe("PenHub context builder", () => {
  test("renders compact state card without raw long output", async () => {
    const workspace = await tempWorkspace()
    const store = new FileAttackStateStore(workspace)
    await store.initChallenge(challenge(workspace))
    await store.appendFact(fact({ id: "fact_1", claim: "Login route exists." }))
    await store.appendHypothesis(hypothesis({ id: "hyp_1", status: "testing", nextTest: "Compare compact responses." }))
    await store.appendBranch(
      branch({ id: "br_1", status: "active", goal: "Inspect login flow.", evidenceIds: ["ev_1"] }),
    )
    await store.appendBranch(branch({ id: "br_2", status: "failed", goal: "Repeat a noisy request." }))
    await store.appendEvidence(evidence({ id: "ev_1", type: "log", summary: "short " + "RAW_OUTPUT ".repeat(80) }))

    const card = await buildStateCard({ workspacePath: workspace, maxFacts: 2, maxHypotheses: 2, maxBranches: 2 })
    expect(card).toContain("# PenHub State Card")
    expect(card).toContain("## Next Best Action Candidates")
    expect(card).toContain("br_1 - Inspect login flow.")
    expect(card).not.toContain("RAW_OUTPUT ".repeat(20))
  })

  test("renders a stable state card snapshot", () => {
    const workspacePath = "/tmp/penhub-snapshot"
    const card = renderStateCard(
      {
        challenge: challenge(workspacePath),
        facts: [fact({ id: "fact_1", claim: "Login route exists." })],
        hypotheses: [
          hypothesis({
            id: "hyp_1",
            claim: "Login bypass might exist.",
            nextTest: "Send a compact probe.",
            confidence: 0.6,
          }),
          hypothesis({ id: "hyp_2", claim: "Admin token leaks in response.", status: "confirmed", confidence: 1 }),
        ],
        branches: [
          branch({ id: "br_open", status: "open", goal: "Inspect login flow." }),
          branch({ id: "br_failed", status: "failed", goal: "Noisy brute force." }),
        ],
        evidence: [evidence({ id: "ev_1", type: "http", summary: "Login returned 200." })],
        failedAttempts: [
          failedAttempt({
            id: "fail_1",
            branchId: "br_failed",
            actionId: "http_probe",
            summary: "Tried default credentials.",
            reason: "Account lockout appeared after retries.",
          }),
        ],
        tokenUsage: {
          ...emptyTokenUsage(),
          totalInputTokens: 8,
          totalOutputTokens: 4,
          totalTokens: 12,
        },
      },
      { maxFacts: 2, maxHypotheses: 2, maxBranches: 2, maxEvidence: 2, maxFailedAttempts: 2 },
    )

    expect(card).toBe(`# PenHub State Card

## Challenge
- Type: web
- Goal: Exercise PenHub state.

## Verified Facts
1. fact_1 - Login route exists. (0.9)

## Open Hypotheses
1. hyp_1 - Login bypass might exist. - open - 0.6 - next: Send a compact probe.

## Confirmed Primitives
1. hyp_2 - Admin token leaks in response.

## Failed / Stale Branches
1. br_failed - failed - Noisy brute force.

## Failed Attempts
1. fail_1 - branch:br_failed, action:http_probe - Tried default credentials. - reason: Account lockout appeared after retries.

## Evidence Summary
1. ev_1 - http - Login returned 200.

## Token Budget
- total: 12
- input: 8
- output: 4

## Next Best Action Candidates
1. br_open - Inspect login flow.
`)
  })
})
