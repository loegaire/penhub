import type { Branch, WorkspaceState } from "@opencode-ai/core/penhub/index"

export function createPenHubDashboardSummary(workspace: WorkspaceState) {
  return {
    challengeName: workspace.challenge.name,
    openHypotheses: workspace.hypotheses.filter(
      (hypothesis) => hypothesis.status === "open" || hypothesis.status === "testing",
    ).length,
    confirmedHypotheses: workspace.hypotheses.filter((hypothesis) => hypothesis.status === "confirmed").length,
    failedBranches: workspace.branches.filter((branch) => branch.status === "failed").length,
    staleBranches: workspace.branches.filter((branch) => branch.status === "stale").length,
    evidenceItems: workspace.evidence.length,
    tokensTotal: workspace.tokenUsage.totalTokens,
    nextBranch: selectNextBranch(workspace.branches),
  }
}

function selectNextBranch(branches: Branch[]) {
  return [...branches]
    .filter((branch) => branch.status === "open" || branch.status === "active")
    .sort((left, right) => branchPriority(right) - branchPriority(left) || left.id.localeCompare(right.id))[0]
}

function branchPriority(branch: Branch) {
  return branch.confidence + branch.progress + branch.novelty - branch.repetitionPenalty
}
