import type { BenchmarkRunResult, BenchmarkRunner } from "./schema"

export type BenchmarkAggregate = {
  runner: BenchmarkRunner
  caseId: string
  model: string
  modelVariant?: string
  trials: number
  successes: number
  passAt1: number
  passAt3?: number
  passAt5?: number
  medianDurationSeconds: number
  medianTokens?: number
  medianToolCalls: number
  medianToolErrors?: number
  medianRepeatedActions: number
  reproductionRate?: number
  milestoneReach: Record<string, number>
}

export function aggregateBenchmarkRuns(runs: BenchmarkRunResult[]) {
  const first = runs[0]
  if (!first) throw new Error("Cannot aggregate an empty benchmark run set")
  if (
    runs.some(
      (run) =>
        run.runner !== first.runner ||
        run.caseId !== first.caseId ||
        run.model !== first.model ||
        run.modelVariant !== first.modelVariant,
    )
  ) {
    throw new Error("Benchmark aggregates require one runner, case, model, and model variant")
  }
  const successes = runs.filter((run) => run.success).length
  const replay = runs.filter((run) => run.replaySuccess !== undefined)
  return {
    runner: first.runner,
    caseId: first.caseId,
    model: first.model,
    ...(first.modelVariant ? { modelVariant: first.modelVariant } : {}),
    trials: runs.length,
    successes,
    passAt1: successes / runs.length,
    ...(runs.length < 3 ? {} : { passAt3: passAtK(runs.length, successes, 3) }),
    ...(runs.length < 5 ? {} : { passAt5: passAtK(runs.length, successes, 5) }),
    medianDurationSeconds: median(runs.map(durationSeconds))!,
    ...(runs.some((run) => run.totalTokens !== undefined)
      ? {
          medianTokens: median(
            runs.map((run) => run.totalTokens).filter((value): value is number => value !== undefined),
          )!,
        }
      : {}),
    medianToolCalls: median(runs.map((run) => run.toolCallsCount))!,
    ...(runs.some((run) => run.toolErrorsCount !== undefined)
      ? {
          medianToolErrors: median(
            runs.map((run) => run.toolErrorsCount).filter((value): value is number => value !== undefined),
          )!,
        }
      : {}),
    medianRepeatedActions: median(runs.map((run) => run.repeatedActionsCount))!,
    ...(replay.length === 0
      ? {}
      : { reproductionRate: replay.filter((run) => run.replaySuccess).length / replay.length }),
    milestoneReach: Object.fromEntries(
      Array.from(new Set(runs.flatMap((run) => run.milestones ?? []))).map((milestone) => [
        milestone,
        runs.filter((run) => run.milestones?.includes(milestone)).length / runs.length,
      ]),
    ),
  } satisfies BenchmarkAggregate
}

export function renderAggregateComparison(baseline: BenchmarkAggregate, penhub: BenchmarkAggregate) {
  if (
    baseline.caseId !== penhub.caseId ||
    baseline.model !== penhub.model ||
    baseline.modelVariant !== penhub.modelVariant
  ) {
    throw new Error("Aggregate comparisons require the same case, model, and model variant")
  }
  return [
    "# PenHub Multi-Trial Benchmark Comparison",
    "",
    `- Case: ${baseline.caseId}`,
    `- Model: ${baseline.model}`,
    `- Model variant: ${baseline.modelVariant ?? "default"}`,
    "",
    "| Metric | OpenCode | PenHub |",
    "| --- | ---: | ---: |",
    row("trials", baseline.trials, penhub.trials),
    row("successes", baseline.successes, penhub.successes),
    row("pass@1", baseline.passAt1, penhub.passAt1),
    row("pass@3", baseline.passAt3, penhub.passAt3),
    row("pass@5", baseline.passAt5, penhub.passAt5),
    row("median_duration_seconds", baseline.medianDurationSeconds, penhub.medianDurationSeconds),
    row("median_tokens", baseline.medianTokens, penhub.medianTokens),
    row("median_tool_calls", baseline.medianToolCalls, penhub.medianToolCalls),
    row("median_tool_errors", baseline.medianToolErrors, penhub.medianToolErrors),
    row("median_repeated_actions", baseline.medianRepeatedActions, penhub.medianRepeatedActions),
    row("reproduction_rate", baseline.reproductionRate, penhub.reproductionRate),
    "",
    "## Milestone reach",
    "",
    "| Milestone | OpenCode | PenHub |",
    "| --- | ---: | ---: |",
    ...Array.from(new Set([...Object.keys(baseline.milestoneReach), ...Object.keys(penhub.milestoneReach)])).map(
      (milestone) => row(milestone, baseline.milestoneReach[milestone], penhub.milestoneReach[milestone]),
    ),
    "",
  ].join("\n")
}

function passAtK(trials: number, successes: number, k: number) {
  if (successes === 0) return 0
  if (trials - successes < k) return 1
  return (
    1 -
    Array.from({ length: k }, (_, index) => (trials - successes - index) / (trials - index)).reduce(
      (product, value) => product * value,
      1,
    )
  )
}

function median(values: number[]) {
  if (values.length === 0) return undefined
  const ordered = values.toSorted((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  if (ordered.length % 2) return ordered[middle]!
  return (ordered[middle - 1]! + ordered[middle]!) / 2
}

function durationSeconds(run: BenchmarkRunResult) {
  return Math.max(0, (Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1_000)
}

function row(label: string, baseline: number | undefined, penhub: number | undefined) {
  return `| ${label} | ${format(baseline)} | ${format(penhub)} |`
}

function format(value: number | undefined) {
  if (value === undefined) return "n/a"
  return Number.isInteger(value) ? String(value) : value.toFixed(3)
}
