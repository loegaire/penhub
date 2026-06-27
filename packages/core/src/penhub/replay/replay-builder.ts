import type { Branch, Evidence, Hypothesis, WorkspaceState } from "../types"

export type ReplayStep = {
  id: string
  title: string
  detail: string
  evidenceIds: string[]
}

export function buildReplaySteps(state: WorkspaceState): ReplayStep[] {
  const evidenceById = new Map(state.evidence.map((item) => [item.id, item]))
  const hypothesesById = new Map(state.hypotheses.map((item) => [item.id, item]))
  const confirmedBranches = state.branches.filter((branch) => branch.status === "confirmed")
  const branches = confirmedBranches.length ? confirmedBranches : evidenceBackedBranches(state.branches, state.evidence)

  return branches.map((branch, index) => branchReplayStep(branch, index, evidenceById, hypothesesById))
}

function evidenceBackedBranches(branches: Branch[], evidence: Evidence[]) {
  const evidenceBranchIds = new Set(evidence.map((item) => item.branchId).filter(Boolean))
  return branches.filter((branch) => branch.evidenceIds.length || evidenceBranchIds.has(branch.id))
}

function branchReplayStep(
  branch: Branch,
  index: number,
  evidenceById: Map<string, Evidence>,
  hypothesesById: Map<string, Hypothesis>,
): ReplayStep {
  const linkedEvidence = branch.evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item): item is Evidence => Boolean(item))
  const linkedHypotheses = branch.hypothesisIds
    .map((id) => hypothesesById.get(id))
    .filter((item): item is Hypothesis => Boolean(item))
  const evidenceIds = linkedEvidence.map((item) => item.id)
  const evidenceSummary = linkedEvidence.length
    ? linkedEvidence.map((item) => `${item.id}: ${item.summary}`).join("; ")
    : "No linked evidence"
  const hypothesisSummary = linkedHypotheses.length
    ? linkedHypotheses.map((item) => `${item.id}: ${item.claim}`).join("; ")
    : "No linked hypothesis"

  return {
    id: `replay_${index + 1}`,
    title: `Replay ${index + 1}: ${branch.goal}`,
    detail: `Reproduce branch ${branch.id} (${branch.status}). Hypotheses: ${hypothesisSummary}. Evidence: ${evidenceSummary}.`,
    evidenceIds,
  }
}
