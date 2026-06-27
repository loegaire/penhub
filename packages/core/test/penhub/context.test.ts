import { describe, expect, test } from "bun:test"
import { buildStateCard, FileAttackStateStore } from "@opencode-ai/core/penhub/index"
import { branch, challenge, evidence, fact, hypothesis, tempWorkspace } from "./helper"

describe("PenHub context builder", () => {
  test("renders compact state card without raw long output", async () => {
    const workspace = await tempWorkspace()
    const store = new FileAttackStateStore(workspace)
    await store.initChallenge(challenge(workspace))
    await store.appendFact(fact({ id: "fact_1", claim: "Login route exists." }))
    await store.appendHypothesis(hypothesis({ id: "hyp_1", status: "testing", nextTest: "Compare compact responses." }))
    await store.appendBranch(branch({ id: "br_1", status: "active", goal: "Inspect login flow.", evidenceIds: ["ev_1"] }))
    await store.appendBranch(branch({ id: "br_2", status: "failed", goal: "Repeat a noisy request." }))
    await store.appendEvidence(evidence({ id: "ev_1", type: "log", summary: "short " + "RAW_OUTPUT ".repeat(80) }))

    const card = await buildStateCard({ workspacePath: workspace, maxFacts: 2, maxHypotheses: 2, maxBranches: 2 })
    expect(card).toContain("# PenHub State Card")
    expect(card).toContain("## Next Best Action Candidates")
    expect(card).toContain("br_1 - Inspect login flow.")
    expect(card).not.toContain("RAW_OUTPUT ".repeat(20))
  })
})
