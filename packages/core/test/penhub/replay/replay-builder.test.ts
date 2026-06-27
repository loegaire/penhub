import { describe, expect, test } from "bun:test"
import { buildReplaySteps, emptyTokenUsage } from "@opencode-ai/core/penhub/index"
import { branch, challenge, evidence, hypothesis } from "../helper"

describe("PenHub replay builder", () => {
  test("builds human-readable replay steps from confirmed branches and evidence", () => {
    const steps = buildReplaySteps({
      challenge: challenge("/tmp/penhub-replay"),
      facts: [],
      hypotheses: [hypothesis({ id: "hyp_1", claim: "Admin access is reachable.", status: "confirmed" })],
      branches: [
        branch({
          id: "br_1",
          status: "confirmed",
          goal: "Validate admin access.",
          evidenceIds: ["ev_1"],
          hypothesisIds: ["hyp_1"],
        }),
      ],
      evidence: [
        evidence({ id: "ev_1", summary: "GET /admin returned 200.", branchId: "br_1", hypothesisId: "hyp_1" }),
      ],
      failedAttempts: [],
      tokenUsage: emptyTokenUsage(),
    })

    expect(steps).toHaveLength(1)
    expect(steps[0]?.title).toContain("Validate admin access")
    expect(steps[0]?.detail).toContain("GET /admin returned 200")
    expect(steps[0]?.evidenceIds).toEqual(["ev_1"])
  })
})
