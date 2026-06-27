import { describe, expect, test } from "bun:test"
import { FileAttackStateStore, TokenBudgetManager } from "@opencode-ai/core/penhub/index"
import { challenge, tempWorkspace } from "./helper"

describe("PenHub token budget", () => {
  test("records usage by branch, action, and hypothesis", async () => {
    const workspace = await tempWorkspace()
    await new FileAttackStateStore(workspace).initChallenge(challenge(workspace))
    const manager = new TokenBudgetManager(workspace)

    await manager.recordUsage({ branchId: "br_1", actionId: "inspect_tree", hypothesisId: "hyp_1", inputTokens: 100, outputTokens: 25 })
    await manager.recordUsage({ branchId: "br_1", actionId: "inspect_tree", inputTokens: 10, outputTokens: 5 })

    const summary = await manager.summarize()
    expect(summary.totalTokens).toBe(140)
    expect(summary.byBranch.br_1).toBe(140)
    expect(summary.byAction.inspect_tree).toBe(140)
    expect(summary.byHypothesis.hyp_1).toBe(125)
  })
})
