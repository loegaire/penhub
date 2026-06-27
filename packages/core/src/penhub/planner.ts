import { pruneBranches, selectNextBranch } from "./attack-tree"
import type { AttackStateStore } from "./state-store"
import type { PlannerDecision } from "./types"

export async function planNextAction(store: AttackStateStore): Promise<PlannerDecision> {
  const state = await store.readWorkspaceState()
  const branch = selectNextBranch(pruneBranches(state.branches))
  if (!branch) {
    return {
      type: "stop",
      reason: "no open or active branches remain after pruning",
    }
  }
  return {
    type: "continue",
    branch,
    reason: branch.evidenceIds.length
      ? "selected highest scoring evidence-backed branch"
      : "selected highest scoring open branch",
  }
}
