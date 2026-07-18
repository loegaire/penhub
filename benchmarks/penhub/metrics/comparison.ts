import type { BenchmarkComparison, BenchmarkRunResult } from "./schema"

export function compareBenchmarkRuns(input: { baseline: BenchmarkRunResult; penhub: BenchmarkRunResult }) {
  if (input.baseline.caseId !== input.penhub.caseId) {
    throw new Error("PenHub benchmark comparisons require the same case")
  }
  if (input.baseline.model !== input.penhub.model) {
    throw new Error("PenHub benchmark comparisons require the same model")
  }
  if (input.baseline.modelVariant !== input.penhub.modelVariant) {
    throw new Error("PenHub benchmark comparisons require the same model variant")
  }

  return {
    caseId: input.baseline.caseId,
    model: input.baseline.model,
    baseline: input.baseline,
    penhub: input.penhub,
    deltas: {
      tokens: optionalDelta(input.baseline.totalTokens, input.penhub.totalTokens),
      timeSeconds: durationSeconds(input.penhub) - durationSeconds(input.baseline),
      toolCalls: input.penhub.toolCallsCount - input.baseline.toolCallsCount,
      repeatedActions: input.penhub.repeatedActionsCount - input.baseline.repeatedActionsCount,
      humanInterventions: input.penhub.humanInterventionsCount - input.baseline.humanInterventionsCount,
    },
    conclusion: comparisonConclusion(input.baseline, input.penhub),
    isSampleData: input.baseline.isSampleData || input.penhub.isSampleData,
  } satisfies BenchmarkComparison
}

export function renderBenchmarkReport(comparison: BenchmarkComparison) {
  return [
    "# PenHub Benchmark Report",
    "",
    "## Setup",
    `- Case: ${comparison.caseId}`,
    `- Model: ${comparison.model}`,
    `- Model variant: ${comparison.baseline.modelVariant ?? "default"}`,
    `- Sample fixture: ${comparison.isSampleData ? "yes" : "no"}`,
    comparison.isSampleData
      ? "- Claim status: No measured product claim; this report uses sample fixture data."
      : "- Claim status: measured benchmark run.",
    "",
    "## Results",
    "| Metric | OpenCode | PenHub | Delta |",
    "| --- | ---: | ---: | ---: |",
    metricRow("solve_success", comparison.baseline.success, comparison.penhub.success, undefined),
    metricRow("flag_found", comparison.baseline.flagFound, comparison.penhub.flagFound, undefined),
    metricRow("tokens_total", comparison.baseline.totalTokens, comparison.penhub.totalTokens, comparison.deltas.tokens),
    metricRow(
      "duration_seconds",
      durationSeconds(comparison.baseline),
      durationSeconds(comparison.penhub),
      comparison.deltas.timeSeconds,
    ),
    metricRow(
      "tool_calls_count",
      comparison.baseline.toolCallsCount,
      comparison.penhub.toolCallsCount,
      comparison.deltas.toolCalls,
    ),
    metricRow(
      "repeated_actions_count",
      comparison.baseline.repeatedActionsCount,
      comparison.penhub.repeatedActionsCount,
      comparison.deltas.repeatedActions,
    ),
    metricRow(
      "human_interventions_count",
      comparison.baseline.humanInterventionsCount,
      comparison.penhub.humanInterventionsCount,
      comparison.deltas.humanInterventions,
    ),
    "",
    "## Evidence",
    `- PenHub evidence items: ${comparison.penhub.evidenceItemsCount ?? "n/a"}`,
    `- PenHub report generated: ${comparison.penhub.reportGenerated ? "yes" : "no"}`,
    `- PenHub replayability score: ${comparison.penhub.reportReplayabilityScore ?? "n/a"}`,
    "",
    "## Notes",
    `- ${comparison.conclusion}`,
    ...(comparison.baseline.notes ?? []).map((note) => `- OpenCode: ${note}`),
    ...(comparison.penhub.notes ?? []).map((note) => `- PenHub: ${note}`),
    "",
  ].join("\n")
}

function optionalDelta(baseline: number | undefined, penhub: number | undefined) {
  if (baseline === undefined || penhub === undefined) return undefined
  return penhub - baseline
}

function durationSeconds(run: BenchmarkRunResult) {
  return Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1_000)
}

function comparisonConclusion(baseline: BenchmarkRunResult, penhub: BenchmarkRunResult) {
  if (baseline.isSampleData || penhub.isSampleData) return "Sample fixture for harness validation only."
  if (penhub.success && !baseline.success) return "PenHub solved the case where baseline OpenCode did not."
  if (penhub.success === baseline.success)
    return "Both runners reached the same solve outcome; inspect efficiency metrics."
  return "OpenCode baseline solved the case where PenHub did not."
}

function metricRow(
  label: string,
  baseline: boolean | number | undefined,
  penhub: boolean | number | undefined,
  delta: number | undefined,
) {
  return `| ${label} | ${formatMetric(baseline)} | ${formatMetric(penhub)} | ${formatMetric(delta)} |`
}

function formatMetric(value: boolean | number | undefined) {
  if (value === undefined) return "n/a"
  if (typeof value === "boolean") return value ? "yes" : "no"
  return String(value)
}
