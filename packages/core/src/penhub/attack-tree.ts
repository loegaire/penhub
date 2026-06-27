import type { Branch } from "./types"

export function scoreBranch(branch: Branch) {
  const normalizedTokenCost = Math.min(Math.max(branch.tokenCost, 0) / 10_000, 1)
  const evidenceBoost = Math.min(branch.evidenceIds.length * 0.02, 0.1)
  const statusPenalty = branch.status === "blocked" ? 0.2 : branch.status === "failed" || branch.status === "stale" ? 1 : 0
  const score =
    branch.confidence * 0.35 +
    branch.progress * 0.3 +
    branch.novelty * 0.2 -
    normalizedTokenCost * 0.1 -
    branch.repetitionPenalty * 0.05 +
    evidenceBoost -
    statusPenalty
  return Math.round(score * 10_000) / 10_000
}

export function rankBranches(branches: Branch[]) {
  return [...branches].sort((left, right) => scoreBranch(right) - scoreBranch(left) || left.id.localeCompare(right.id))
}

export function pruneBranches(branches: Branch[]) {
  return rankBranches(
    branches.filter((branch) => {
      if (branch.status === "failed" || branch.status === "stale") return false
      if (branch.progress < 0.2 && branch.tokenCost > 8_000) return false
      return scoreBranch(branch) > -0.2
    }),
  )
}

export function selectNextBranch(branches: Branch[]) {
  return rankBranches(branches.filter((branch) => branch.status === "open" || branch.status === "active"))[0]
}
