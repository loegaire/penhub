import { access } from "node:fs/promises"
import { describe, expect, test } from "bun:test"
import { FileAttackStateStore, statePaths } from "@opencode-ai/core/penhub/index"
import { branch, challenge, evidence, fact, failedAttempt, hypothesis, tempWorkspace } from "./helper"

describe("PenHub state store", () => {
  test("initializes .penhub state and reads workspace state", async () => {
    const workspace = await tempWorkspace()
    const store = new FileAttackStateStore(workspace)
    await store.initChallenge(challenge(workspace))

    const paths = statePaths(workspace)
    await access(paths.challenge)
    await access(paths.facts)
    await access(paths.hypotheses)
    await access(paths.branches)
    await access(paths.evidence)
    await access(paths.failedAttempts)
    await access(paths.tokenUsage)
    await access(paths.report)

    await store.appendFact(fact())
    await store.appendHypothesis(hypothesis())
    await store.appendBranch(branch())
    await store.appendEvidence(evidence())
    await store.appendFailedAttempt(failedAttempt())

    const state = await store.readWorkspaceState()
    expect(state.challenge.id).toBe("challenge_test")
    expect(state.facts).toHaveLength(1)
    expect(state.hypotheses).toHaveLength(1)
    expect(state.branches).toHaveLength(1)
    expect(state.evidence).toHaveLength(1)
    expect(state.failedAttempts).toHaveLength(1)
    expect(state.tokenUsage.totalTokens).toBe(0)
  })

  test("updates hypothesis and branch records deterministically", async () => {
    const workspace = await tempWorkspace()
    const store = new FileAttackStateStore(workspace)
    await store.initChallenge(challenge(workspace))
    await store.appendHypothesis(hypothesis())
    await store.appendBranch(branch())

    await store.updateHypothesis("hyp_test", { status: "testing", updatedAt: "2026-01-01T00:02:00.000Z" })
    await store.updateBranch("br_test", { status: "active", progress: 0.8 })

    expect((await store.listHypotheses())[0]?.status).toBe("testing")
    expect((await store.listBranches())[0]?.status).toBe("active")
  })

  test("filters failed attempt records by branch, hypothesis, and action", async () => {
    const workspace = await tempWorkspace()
    const store = new FileAttackStateStore(workspace)
    await store.initChallenge(challenge(workspace))
    await store.appendFailedAttempt(
      failedAttempt({ id: "fail_1", branchId: "br_1", hypothesisId: "hyp_1", actionId: "http_probe" }),
    )
    await store.appendFailedAttempt(
      failedAttempt({ id: "fail_2", branchId: "br_2", hypothesisId: "hyp_2", actionId: "dir_fuzz" }),
    )

    expect((await store.listFailedAttempts({ branchId: "br_1" })).map((item) => item.id)).toEqual(["fail_1"])
    expect((await store.listFailedAttempts({ hypothesisId: "hyp_2" })).map((item) => item.id)).toEqual(["fail_2"])
    expect((await store.listFailedAttempts({ actionId: "http_probe" })).map((item) => item.id)).toEqual(["fail_1"])
  })
})
