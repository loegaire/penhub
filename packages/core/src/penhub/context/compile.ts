export * as PenHubContextCompiler from "./compile"

import { PenHubRunStore } from "../run/store"

export async function compileTaskCard(workspace: string) {
  const run = await PenHubRunStore.read(workspace)
  if (!run) throw new Error("PenHub run state has not been initialized")
  const attempts = await PenHubRunStore.listAttempts(workspace)
  const lessons = await PenHubRunStore.listLessons(workspace)
  const active = run.branches.find((branch) => branch.id === run.activeBranchId)
  const relevantAttempts = attempts.filter((attempt) => attempt.branchId === active?.id).slice(-3)
  const relevantLessons = lessons.filter((lesson) => lesson.branchId === active?.id).slice(-2)
  const alternatives = run.branches.filter((branch) => branch.status === "queued")
  const artifacts = Array.from(
    new Set([
      ...relevantAttempts.flatMap((attempt) => (attempt.artifactPath ? [attempt.artifactPath] : [])),
      ...run.findings.flatMap((finding) => finding.artifactPaths),
    ]),
  )
  return [
    "# PenHub Task Card",
    "",
    "## Goal",
    run.goal,
    "",
    "## Run",
    `- Status: ${run.status}`,
    `- Phase: ${run.phase}`,
    `- Required next behavior: ${directive(run.phase, run.status)}`,
    "",
    "## Active Branch",
    active
      ? `- ${active.id}: ${active.claim}\n- Smallest decisive test: ${active.nextTest}\n- Expected signal: ${active.expectedSignal}`
      : "- None. Propose at most three branches and activate the smallest decisive test.",
    "",
    "## Verified Findings",
    ...numbered(run.findings.map((finding) => `${finding.claim} (${finding.verificationMethod})`)),
    "",
    "## Verified Milestones",
    ...numbered(run.milestoneIds),
    "",
    "## Last Three Attempts On This Branch",
    ...numbered(
      relevantAttempts.map(
        (attempt) =>
          `${attempt.tool} [${attempt.status}] ${clip(attempt.observation, 240)}${attempt.artifactPath ? ` -> ${attempt.artifactPath}` : ""}`,
      ),
    ),
    "",
    "## Known Failed Approaches",
    ...numbered(
      relevantLessons.map(
        (lesson) =>
          `${clip(lesson.failedAssumption, 160)} Avoid: ${clip(lesson.avoid, 120)} Next: ${clip(lesson.nextTest, 160)}`,
      ),
    ),
    "",
    "## Remaining Branches",
    ...numbered(alternatives.map((branch) => `${branch.id}: ${clip(branch.claim, 200)}`)),
    "",
    "## Relevant Artifacts",
    ...numbered(artifacts),
    "",
    "## Remaining Budget",
    `- Actions: ${Math.max(0, run.budgets.maxAttempts - run.attemptCount)}`,
    `- Provider turns: ${Math.max(0, run.budgets.maxProviderTurns - run.providerTurns)}`,
    `- Tokens: ${run.budgets.maxTokens === undefined ? "unbounded" : Math.max(0, run.budgets.maxTokens - run.tokenCount)}`,
    "",
  ].join("\n")
}

function directive(phase: string, status: string) {
  if (status === "solved") return "Report only the independently verified result and reproduction evidence."
  if (status !== "active") return "Report the concrete blocker or exhausted budget without claiming success."
  if (phase === "plan") return "Create no more than three branches, then select one decisive test."
  if (phase === "reflect") return "Record one bounded reflection before retrying or switching branches."
  if (phase === "verify") return "Run the configured executable oracle; prose cannot complete the run."
  return "Execute the active branch's smallest decisive test and observe the real result."
}

function numbered(values: readonly string[]) {
  return values.length ? values.map((value, index) => `${index + 1}. ${value}`) : ["1. None"]
}

function clip(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim()
  return normalized.length <= limit ? normalized : normalized.slice(0, limit - 3).trimEnd() + "..."
}
