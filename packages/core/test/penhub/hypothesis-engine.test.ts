import { describe, expect, test } from "bun:test"
import { FileAttackStateStore, HypothesisEngine } from "@opencode-ai/core/penhub/index"
import { challenge, tempWorkspace } from "./helper"

describe("PenHub hypothesis engine", () => {
  test("persists open to testing to confirmed lifecycle", async () => {
    const workspace = await tempWorkspace()
    const store = new FileAttackStateStore(workspace)
    await store.initChallenge(challenge(workspace))
    const engine = new HypothesisEngine(
      store,
      () => "2026-01-01T00:00:00.000Z",
      () => "fixed",
    )

    const created = await engine.create({ claim: "Test claim", requiredEvidence: ["ev_1"], confidence: 0.4 })
    await engine.markTesting(created.id)
    await engine.markConfirmed(created.id, ["ev_2"])

    const [updated] = await store.listHypotheses({ id: created.id })
    expect(created.id).toBe("hyp_fixed")
    expect(updated?.status).toBe("confirmed")
    expect(updated?.requiredEvidence).toEqual(["ev_1", "ev_2"])
    expect(updated?.confidence).toBe(1)
  })
})
