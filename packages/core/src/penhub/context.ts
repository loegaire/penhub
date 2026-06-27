import { FileAttackStateStore } from "./state-store"
import type { Branch, WorkspaceState } from "./types"

export type ContextBuilderInput = {
  workspacePath: string
  maxFacts?: number
  maxHypotheses?: number
  maxBranches?: number
  maxEvidence?: number
  tokenBudget?: number
}

export async function buildStateCard(input: ContextBuilderInput) {
  const state = await new FileAttackStateStore(input.workspacePath).readWorkspaceState()
  return renderStateCard(state, input)
}

export function renderStateCard(state: WorkspaceState, input: Omit<ContextBuilderInput, "workspacePath"> = {}) {
  const compact = input.tokenBudget !== undefined && input.tokenBudget < 2_000
  const maxLine = compact ? 120 : 180
  const maxFacts = input.maxFacts ?? (compact ? 4 : 8)
  const maxHypotheses = input.maxHypotheses ?? (compact ? 3 : 6)
  const maxBranches = input.maxBranches ?? (compact ? 3 : 6)
  const maxEvidence = input.maxEvidence ?? (compact ? 3 : 6)
  const next = nextBranchCandidates(state.branches, maxBranches)

  return [
    "# PenHub State Card",
    "",
    "## Challenge",
    `- Type: ${state.challenge.type}`,
    `- Goal: ${clip(state.challenge.goal, maxLine)}`,
    "",
    "## Verified Facts",
    ...numbered(
      state.facts
        .filter((fact) => fact.confidence >= 0.7)
        .slice(0, maxFacts)
        .map((fact) => `${fact.id} - ${clip(fact.claim, maxLine)} (${fact.confidence})`),
    ),
    "",
    "## Open Hypotheses",
    ...numbered(
      state.hypotheses
        .filter((hypothesis) => hypothesis.status === "open" || hypothesis.status === "testing")
        .slice(0, maxHypotheses)
        .map((hypothesis) => {
          const nextTest = hypothesis.nextTest ? ` - next: ${clip(hypothesis.nextTest, 80)}` : ""
          return `${hypothesis.id} - ${clip(hypothesis.claim, maxLine)} - ${hypothesis.status} - ${hypothesis.confidence}${nextTest}`
        }),
    ),
    "",
    "## Confirmed Primitives",
    ...numbered(
      state.hypotheses
        .filter((hypothesis) => hypothesis.status === "confirmed")
        .slice(0, maxHypotheses)
        .map((hypothesis) => `${hypothesis.id} - ${clip(hypothesis.claim, maxLine)}`),
    ),
    "",
    "## Failed / Stale Branches",
    ...numbered(
      state.branches
        .filter((branch) => branch.status === "failed" || branch.status === "stale" || branch.status === "blocked")
        .slice(0, maxBranches)
        .map((branch) => `${branch.id} - ${branch.status} - ${clip(branch.goal, maxLine)}`),
    ),
    "",
    "## Evidence Summary",
    ...numbered(
      state.evidence
        .slice(0, maxEvidence)
        .map((evidence) => `${evidence.id} - ${evidence.type} - ${clip(evidence.summary, maxLine)}`),
    ),
    "",
    "## Token Budget",
    `- total: ${state.tokenUsage.totalTokens}`,
    `- input: ${state.tokenUsage.totalInputTokens}`,
    `- output: ${state.tokenUsage.totalOutputTokens}`,
    "",
    "## Next Best Action Candidates",
    ...numbered(next.map((branch) => `${branch.id} - ${clip(branch.goal, maxLine)}`)),
    "",
  ].join("\n")
}

export function clip(value: string, max: number) {
  const normalized = value.replace(/\s+/g, " ").trim()
  return normalized.length <= max ? normalized : normalized.slice(0, Math.max(0, max - 3)).trim() + "..."
}

function numbered(values: string[]) {
  return values.length ? values.map((value, index) => `${index + 1}. ${value}`) : ["1. None"]
}

function nextBranchCandidates(branches: Branch[], limit: number) {
  return [...branches]
    .filter((branch) => branch.status === "open" || branch.status === "active")
    .sort((left, right) => {
      const leftScore = left.confidence + left.progress + left.novelty - left.repetitionPenalty
      const rightScore = right.confidence + right.progress + right.novelty - right.repetitionPenalty
      return rightScore - leftScore || left.id.localeCompare(right.id)
    })
    .slice(0, limit)
}
