import { writeFile } from "node:fs/promises"
import { buildReplaySteps } from "../replay/replay-builder"
import { statePaths } from "../state-paths"
import { FileAttackStateStore } from "../state-store"
import type { Evidence, WorkspaceState } from "../types"

export type GenerateMarkdownReportInput = {
  workspacePath: string
  outputPath?: string
}

export type GeneratedMarkdownReport = {
  reportPath: string
  markdown: string
}

export async function generateMarkdownReport(input: GenerateMarkdownReportInput): Promise<GeneratedMarkdownReport> {
  const state = await new FileAttackStateStore(input.workspacePath).readWorkspaceState()
  const markdown = renderMarkdownReport(state)
  const reportPath = input.outputPath ?? statePaths(input.workspacePath).report
  await writeFile(reportPath, markdown, "utf8")
  return { reportPath, markdown }
}

export function renderMarkdownReport(state: WorkspaceState) {
  const replaySteps = buildReplaySteps(state)
  const flagEvidence = findFlagEvidence(state.evidence)
  return [
    "# PenHub Report",
    "",
    "## Summary",
    summaryLine(state),
    "",
    "## Challenge",
    `- Name: ${state.challenge.name}`,
    `- Type: ${state.challenge.type}`,
    `- Goal: ${state.challenge.goal}`,
    `- Workspace: ${state.challenge.workspacePath}`,
    "",
    "## Final Result / Flag",
    flagEvidence ? `- ${flagEvidence.summary}` : "- Not confirmed yet.",
    "",
    "## Attack Chain",
    ...numbered(
      state.branches
        .filter((branch) => branch.status === "confirmed" || branch.evidenceIds.length)
        .map((branch) => `${branch.id} - ${branch.status} - ${branch.goal}`),
    ),
    "",
    "## Evidence Table",
    "| ID | Type | Supports | Summary | Artifact |",
    "| --- | --- | --- | --- | --- |",
    ...state.evidence.map(
      (item) =>
        `| ${escapeTable(item.id)} | ${escapeTable(item.type)} | ${escapeTable(item.supports.join(", ") || "-")} | ${escapeTable(
          item.summary,
        )} | ${escapeTable(item.artifactPath ?? "-")} |`,
    ),
    "",
    "## Replay Steps",
    ...numbered(replaySteps.map((step) => `${step.title} - ${step.detail}`)),
    "",
    "## Failed Branches",
    ...numbered(
      state.branches
        .filter((branch) => branch.status === "failed" || branch.status === "stale" || branch.status === "blocked")
        .map((branch) => `${branch.id} - ${branch.status} - ${branch.goal}`),
    ),
    "",
    "## Token Usage",
    `- Input tokens: ${state.tokenUsage.totalInputTokens}`,
    `- Output tokens: ${state.tokenUsage.totalOutputTokens}`,
    `- Total tokens: ${state.tokenUsage.totalTokens}`,
    "",
    "## Human Effort",
    `- Failed attempts recorded: ${state.failedAttempts.length}`,
    `- Evidence items recorded: ${state.evidence.length}`,
    "",
    "## Appendix",
    "### Facts",
    ...numbered(state.facts.map((fact) => `${fact.id} - ${fact.claim} (${fact.confidence})`)),
    "",
    "### Hypotheses",
    ...numbered(state.hypotheses.map((hypothesis) => `${hypothesis.id} - ${hypothesis.status} - ${hypothesis.claim}`)),
    "",
  ].join("\n")
}

function summaryLine(state: WorkspaceState) {
  const confirmed = state.branches.filter((branch) => branch.status === "confirmed").length
  return `PenHub tracked ${state.facts.length} facts, ${state.hypotheses.length} hypotheses, ${state.branches.length} branches, ${state.evidence.length} evidence items, and ${confirmed} confirmed branches.`
}

function findFlagEvidence(evidence: Evidence[]) {
  return evidence.find((item) => item.type === "flag" || /flag\{|ctf\{|final result/i.test(item.summary))
}

function numbered(values: string[]) {
  return values.length ? values.map((value, index) => `${index + 1}. ${value}`) : ["1. None"]
}

function escapeTable(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim()
}
