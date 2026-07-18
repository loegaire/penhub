import { describe, expect, test } from "bun:test"
import type { BenchmarkRunResult } from "./schema"
import { aggregateBenchmarkRuns, renderAggregateComparison } from "./aggregate"

const run = (trial: number, success: boolean): BenchmarkRunResult => ({
  runner: "penhub",
  caseId: "controlled-001",
  model: "test/model",
  modelVariant: "high",
  startedAt: `2026-07-17T00:0${trial}:00.000Z`,
  finishedAt: `2026-07-17T00:0${trial}:10.000Z`,
  success,
  flagFound: success,
  toolCallsCount: trial,
  repeatedActionsCount: 0,
  humanInterventionsCount: 0,
  reportGenerated: false,
  totalTokens: trial * 100,
  milestones: success ? ["candidate", "verified"] : ["candidate"],
  replaySuccess: success,
  isSampleData: false,
})

describe("PenHub multi-trial benchmark metrics", () => {
  test("computes pass estimates, medians, milestones, and reproduction", () => {
    const aggregate = aggregateBenchmarkRuns([run(1, true), run(2, false), run(3, true)])

    expect(aggregate.passAt1).toBeCloseTo(2 / 3)
    expect(aggregate.passAt3).toBe(1)
    expect(aggregate.medianTokens).toBe(200)
    expect(aggregate.milestoneReach.verified).toBeCloseTo(2 / 3)
    expect(aggregate.reproductionRate).toBeCloseTo(2 / 3)
  })

  test("renders only matched aggregate comparisons", () => {
    const penhub = aggregateBenchmarkRuns([run(1, true)])
    const baseline = aggregateBenchmarkRuns([{ ...run(1, false), runner: "opencode-baseline" }])

    expect(renderAggregateComparison(baseline, penhub)).toContain("# PenHub Multi-Trial Benchmark Comparison")
    expect(() => renderAggregateComparison({ ...baseline, modelVariant: "low" }, penhub)).toThrow("same case")
  })
})
