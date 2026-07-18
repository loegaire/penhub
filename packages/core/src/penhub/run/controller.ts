export * as PenHubRunController from "./controller"

import { randomUUID } from "node:crypto"
import { PenHubRunStore } from "./store"
import type { Branch, Lesson, RunState } from "./state"

const MAX_OPEN_BRANCHES = 3
const MAX_NO_PROGRESS_ATTEMPTS = 2
const MAX_REFLECTION_RETRIES = 1

export async function requiresAction(workspace: string, sessionId: string) {
  const run = await PenHubRunStore.read(workspace)
  return run?.sessionId === sessionId && run.status === "active"
}

export async function addBranch(workspace: string, input: Pick<Branch, "claim" | "nextTest" | "expectedSignal">) {
  const run = await requireRun(workspace)
  if (
    run.branches.filter((branch) => branch.status === "queued" || branch.status === "active").length >=
    MAX_OPEN_BRANCHES
  ) {
    throw new Error(`PenHub allows at most ${MAX_OPEN_BRANCHES} open branches`)
  }
  const now = new Date().toISOString()
  const branch: Branch = {
    id: `branch_${randomUUID()}`,
    ...input,
    status: run.activeBranchId ? "queued" : "active",
    attempts: 0,
    reflectionRetries: 0,
    createdAt: now,
    updatedAt: now,
  }
  await PenHubRunStore.write(workspace, {
    ...run,
    phase: "act",
    activeBranchId: run.activeBranchId ?? branch.id,
    branches: [...run.branches, branch],
  })
  return branch
}

export async function supportBranch(workspace: string, branchId: string) {
  const run = await requireRun(workspace)
  await PenHubRunStore.write(workspace, {
    ...run,
    phase: "verify",
    branches: run.branches.map((branch) =>
      branch.id === branchId ? { ...branch, status: "supported", updatedAt: new Date().toISOString() } : branch,
    ),
  })
}

export async function reflect(workspace: string, input: Omit<Lesson, "id" | "branchId" | "attemptIds" | "createdAt">) {
  const run = await requireRun(workspace)
  const branch = run.branches.find((item) => item.id === run.activeBranchId)
  if (!branch) throw new Error("PenHub has no active branch to reflect on")
  if (branch.reflectionRetries >= MAX_REFLECTION_RETRIES) {
    throw new Error("The active PenHub branch has already used its reflection retry")
  }
  const attempts = (await PenHubRunStore.listAttempts(workspace)).filter((attempt) => attempt.branchId === branch.id)
  const lesson: Lesson = {
    id: `lesson_${randomUUID()}`,
    branchId: branch.id,
    attemptIds: attempts.slice(-MAX_NO_PROGRESS_ATTEMPTS).map((attempt) => attempt.id),
    ...input,
    createdAt: new Date().toISOString(),
  }
  await PenHubRunStore.appendLesson(workspace, lesson)
  await PenHubRunStore.write(workspace, {
    ...run,
    phase: "act",
    reflectionPendingBranchId: branch.id,
    noProgressTurns: 0,
    branches: run.branches.map((item) =>
      item.id === branch.id
        ? {
            ...item,
            nextTest: input.nextTest,
            reflectionRetries: item.reflectionRetries + 1,
            updatedAt: new Date().toISOString(),
          }
        : item,
    ),
  })
  return lesson
}

export async function switchBranch(workspace: string, reason: string) {
  const run = await requireRun(workspace)
  return switchFrom(run, workspace, reason)
}

export async function afterTurn(
  workspace: string,
  input: { sessionId: string; canContinue: boolean },
): Promise<{ managed: boolean; continue: boolean; reason?: string }> {
  const run = await PenHubRunStore.read(workspace)
  if (!run || run.sessionId !== input.sessionId) return { managed: false, continue: false }
  if (run.status !== "active") {
    if (!run.finalResponsePending || !input.canContinue) return { managed: true, continue: false }
    await PenHubRunStore.write(workspace, { ...run, finalResponsePending: false })
    return { managed: true, continue: true, reason: `report ${run.status}` }
  }
  if (!input.canContinue) {
    await PenHubRunStore.write(workspace, {
      ...run,
      status: "budget-exhausted",
      finalResponsePending: false,
    })
    return { managed: true, continue: false, reason: "provider-turn limit reached" }
  }
  if (budgetExhausted(run)) {
    await PenHubRunStore.write(workspace, {
      ...run,
      status: "budget-exhausted",
      finalResponsePending: true,
    })
    return { managed: true, continue: true, reason: "PenHub run budget exhausted" }
  }

  const attempts = (await PenHubRunStore.listAttempts(workspace)).filter(
    (attempt) => attempt.branchId === run.activeBranchId,
  )
  if (run.phase === "reflect" && run.attemptCount > run.lastDecisionAttemptCount) {
    await switchFrom(run, workspace, "operator did not record the required bounded reflection")
    return { managed: true, continue: true, reason: "switch branch after skipped reflection" }
  }
  if (run.reflectionPendingBranchId === run.activeBranchId) {
    await PenHubRunStore.write(workspace, {
      ...run,
      lastDecisionAttemptCount: run.attemptCount,
      noProgressTurns: 0,
    })
    return { managed: true, continue: true, reason: "run the post-reflection retry" }
  }
  const newAttempt = run.attemptCount > run.lastDecisionAttemptCount
  const recent = attempts.slice(-MAX_NO_PROGRESS_ATTEMPTS)
  const repeated =
    recent.length === MAX_NO_PROGRESS_ATTEMPTS &&
    (new Set(recent.map((attempt) => attempt.normalizedArgsHash)).size === 1 ||
      new Set(recent.map((attempt) => attempt.observationHash)).size === 1)
  if (repeated && run.phase !== "reflect") {
    const branch = run.branches.find((item) => item.id === run.activeBranchId)
    if (branch && branch.reflectionRetries < MAX_REFLECTION_RETRIES) {
      await PenHubRunStore.write(workspace, {
        ...run,
        phase: "reflect",
        lastDecisionAttemptCount: run.attemptCount,
        noProgressTurns: 0,
      })
      return { managed: true, continue: true, reason: "reflect after two attempts without new evidence" }
    }
    await switchFrom(run, workspace, "repeated action or observation after reflection")
    return {
      managed: true,
      continue: true,
      reason: "switch branch after bounded reflection",
    }
  }
  const noProgressTurns = newAttempt ? 0 : run.noProgressTurns + 1
  if (noProgressTurns >= MAX_NO_PROGRESS_ATTEMPTS && run.branches.length > 0) {
    await switchFrom(run, workspace, "operator produced no new executable observation")
    return {
      managed: true,
      continue: true,
      reason: "switch branch after no progress",
    }
  }
  await PenHubRunStore.write(workspace, {
    ...run,
    lastDecisionAttemptCount: run.attemptCount,
    noProgressTurns,
  })
  return { managed: true, continue: true, reason: run.phase === "reflect" ? "reflection required" : "run active" }
}

async function switchFrom(run: RunState, workspace: string, reason: string) {
  const next = run.branches.find((branch) => branch.status === "queued")
  const now = new Date().toISOString()
  if (!next) {
    await PenHubRunStore.write(workspace, {
      ...run,
      status: "blocked",
      phase: "complete",
      activeBranchId: undefined,
      reflectionPendingBranchId: undefined,
      finalResponsePending: true,
      branches: run.branches.map((branch) =>
        branch.id === run.activeBranchId ? { ...branch, status: "blocked", updatedAt: now } : branch,
      ),
    })
    return undefined
  }
  await PenHubRunStore.write(workspace, {
    ...run,
    phase: "act",
    activeBranchId: next.id,
    reflectionPendingBranchId: undefined,
    noProgressTurns: 0,
    branches: run.branches.map((branch) => {
      if (branch.id === run.activeBranchId) return { ...branch, status: "blocked", updatedAt: now }
      if (branch.id === next.id) return { ...branch, status: "active", updatedAt: now }
      return branch
    }),
  })
  await PenHubRunStore.appendLesson(workspace, {
    id: `lesson_${randomUUID()}`,
    branchId: run.activeBranchId ?? next.id,
    attemptIds: [],
    failedAssumption: reason,
    validObservations: [],
    avoid: "Do not repeat the blocked branch unchanged.",
    nextTest: next.nextTest,
    createdAt: now,
  })
  return next
}

function budgetExhausted(run: RunState) {
  if (run.attemptCount >= run.budgets.maxAttempts) return true
  if (run.providerTurns >= run.budgets.maxProviderTurns) return true
  return run.budgets.maxTokens !== undefined && run.tokenCount >= run.budgets.maxTokens
}

async function requireRun(workspace: string) {
  const run = await PenHubRunStore.read(workspace)
  if (!run) throw new Error("PenHub run state has not been initialized")
  if (run.status !== "active") throw new Error(`PenHub run is ${run.status}`)
  return run
}
