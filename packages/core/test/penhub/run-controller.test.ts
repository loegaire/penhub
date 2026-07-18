import { describe, expect, test } from "bun:test"
import {
  PenHubContextCompiler,
  PenHubRunController,
  PenHubRunStore,
  type PenHubRunState,
} from "@opencode-ai/core/penhub/index"
import { tempWorkspace } from "./helper"

describe("PenHub bounded run controller", () => {
  test("keeps three simple branches and switches only after one reflection", async () => {
    const workspace = await tempWorkspace()
    await PenHubRunStore.initialize(workspace, { goal: "Recover the flag", sessionId: "session-test" })
    const first = await PenHubRunController.addBranch(workspace, {
      claim: "The parser accepts a malformed record.",
      nextTest: "Submit one malformed record.",
      expectedSignal: "The protected parser path is reached.",
    })
    const second = await PenHubRunController.addBranch(workspace, {
      claim: "The checker leaks a comparison result.",
      nextTest: "Compare two single-byte candidates.",
      expectedSignal: "Responses differ by candidate byte.",
    })
    await PenHubRunController.addBranch(workspace, {
      claim: "The stored artifact contains the secret.",
      nextTest: "Search bounded artifact windows.",
      expectedSignal: "A flag-shaped value appears.",
    })
    await expect(
      PenHubRunController.addBranch(workspace, {
        claim: "Too many branches.",
        nextTest: "Do not run.",
        expectedSignal: "None.",
      }),
    ).rejects.toThrow()

    await addRepeatedAttempts(workspace, first.id, 1)
    expect(
      (await PenHubRunController.afterTurn(workspace, { sessionId: "session-test", canContinue: true })).reason,
    ).toContain("reflect")
    expect((await PenHubRunStore.read(workspace))?.phase).toBe("reflect")

    await PenHubRunController.reflect(workspace, {
      failedAssumption: "Malformed length alone would reach the protected path.",
      validObservations: ["The parser accepted the header."],
      avoid: "Do not resend the same length unchanged.",
      nextTest: "Change both the type and length fields.",
    })
    await addRepeatedAttempts(workspace, first.id, 3)
    await PenHubRunController.afterTurn(workspace, { sessionId: "session-test", canContinue: true })

    const switched = await PenHubRunStore.read(workspace)
    expect(switched?.activeBranchId).toBe(second.id)
    expect(switched?.branches.find((branch) => branch.id === first.id)?.status).toBe("blocked")
    expect(switched?.branches.find((branch) => branch.id === second.id)?.status).toBe("active")
  })

  test("compiles only branch-relevant attempts into the task card", async () => {
    const workspace = await tempWorkspace()
    await PenHubRunStore.initialize(workspace, { goal: "Recover the flag", sessionId: "session-test" })
    const active = await PenHubRunController.addBranch(workspace, {
      claim: "Active claim",
      nextTest: "Active test",
      expectedSignal: "Active signal",
    })
    const queued = await PenHubRunController.addBranch(workspace, {
      claim: "Queued claim",
      nextTest: "Queued test",
      expectedSignal: "Queued signal",
    })
    await PenHubRunStore.appendAttempt(workspace, attempt(active.id, 1, "active observation"))
    await PenHubRunStore.appendAttempt(workspace, attempt(queued.id, 2, "unrelated observation"))

    const card = await PenHubContextCompiler.compileTaskCard(workspace)
    expect(card).toContain("Active claim")
    expect(card).toContain("active observation")
    expect(card).toContain("Queued claim")
    expect(card).not.toContain("unrelated observation")
  })

  test("does not allow the operator to skip a requested reflection", async () => {
    const workspace = await tempWorkspace()
    await PenHubRunStore.initialize(workspace, { goal: "Recover the flag", sessionId: "session-test" })
    const branch = await PenHubRunController.addBranch(workspace, {
      claim: "One branch",
      nextTest: "Run one test",
      expectedSignal: "Observe one signal",
    })
    await addRepeatedAttempts(workspace, branch.id, 1)
    await PenHubRunController.afterTurn(workspace, { sessionId: "session-test", canContinue: true })
    const reflecting = await PenHubRunStore.read(workspace)
    if (!reflecting) throw new Error("missing run")
    await PenHubRunStore.write(workspace, { ...reflecting, attemptCount: reflecting.attemptCount + 1 })

    const decision = await PenHubRunController.afterTurn(workspace, {
      sessionId: "session-test",
      canContinue: true,
    })
    expect(decision.reason).toContain("skipped reflection")
    expect((await PenHubRunStore.read(workspace))?.status).toBe("blocked")
  })
})

async function addRepeatedAttempts(workspace: string, branchId: string, start: number) {
  await PenHubRunStore.appendAttempt(workspace, attempt(branchId, start, "same observation"))
  await PenHubRunStore.appendAttempt(workspace, attempt(branchId, start + 1, "same observation"))
  const run = await PenHubRunStore.read(workspace)
  if (!run) throw new Error("missing run")
  await PenHubRunStore.write(workspace, {
    ...run,
    attemptCount: start + 1,
    reflectionPendingBranchId: undefined,
    branches: run.branches.map((branch) =>
      branch.id === branchId ? { ...branch, attempts: branch.attempts + 2 } : branch,
    ),
  })
}

function attempt(branchId: string, index: number, observation: string): PenHubRunState.Attempt {
  return {
    id: `attempt-${index}`,
    sessionId: "session-test",
    callId: `call-${index}`,
    branchId,
    tool: "sec_test",
    normalizedArgsHash: "same-args",
    status: "success",
    observation,
    observationHash: "same-observation",
    startedAt: "2026-07-17T00:00:00.000Z",
    finishedAt: "2026-07-17T00:00:01.000Z",
    durationMs: 1_000,
    outputBytes: observation.length,
  }
}
