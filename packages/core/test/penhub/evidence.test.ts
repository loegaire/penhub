import { describe, expect, test } from "bun:test"
import { FileAttackStateStore, recordEvidence } from "@opencode-ai/core/penhub/index"
import { challenge, tempWorkspace } from "./helper"

describe("PenHub evidence helpers", () => {
  test("records evidence with deterministic ID injection", async () => {
    const workspace = await tempWorkspace()
    const store = new FileAttackStateStore(workspace)
    await store.initChallenge(challenge(workspace))

    const recorded = await recordEvidence({
      workspacePath: workspace,
      idGenerator: () => "fixed",
      type: "manual",
      summary: "Manual confirmation.",
      branchId: "br_1",
      createdAt: "2026-01-01T00:03:00.000Z",
    })

    expect(recorded.id).toBe("ev_fixed")
    expect((await store.listEvidence({ branchId: "br_1" })).map((item) => item.id)).toEqual(["ev_fixed"])
  })
})
