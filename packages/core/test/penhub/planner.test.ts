import { describe, expect, test } from "bun:test"
import { FileAttackStateStore, planNextAction } from "@opencode-ai/core/penhub/index"
import { branch, challenge, tempWorkspace } from "./helper"

describe("PenHub planner facade", () => {
  test("continues with the highest scoring open or active branch", async () => {
    const workspace = await tempWorkspace()
    const store = new FileAttackStateStore(workspace)
    await store.initChallenge(challenge(workspace))
    await store.appendBranch(branch({ id: "br_low", status: "open", confidence: 0.3, progress: 0.2, novelty: 0.2 }))
    await store.appendBranch(
      branch({
        id: "br_high",
        status: "active",
        confidence: 0.9,
        progress: 0.8,
        novelty: 0.7,
        evidenceIds: ["ev_1"],
      }),
    )

    const decision = await planNextAction(store)

    expect(decision.type).toBe("continue")
    if (decision.type === "continue") {
      expect(decision.branch.id).toBe("br_high")
      expect(decision.reason).toContain("evidence-backed")
    }
  })

  test("stops when no branch remains actionable", async () => {
    const workspace = await tempWorkspace()
    const store = new FileAttackStateStore(workspace)
    await store.initChallenge(challenge(workspace))
    await store.appendBranch(branch({ id: "br_failed", status: "failed" }))
    await store.appendBranch(branch({ id: "br_stale", status: "stale" }))

    const decision = await planNextAction(store)

    expect(decision).toEqual({
      type: "stop",
      reason: "no open or active branches remain after pruning",
    })
  })
})
