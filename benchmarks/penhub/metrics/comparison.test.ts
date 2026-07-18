import { describe, expect, test } from "bun:test"
import { compareBenchmarkRuns, renderBenchmarkReport } from "./comparison"
import type { BenchmarkRunResult } from "./schema"

const baseline: BenchmarkRunResult = {
  runner: "opencode-baseline",
  caseId: "local-web-chain-001",
  model: "sample-model",
  startedAt: "2026-06-27T08:00:00.000Z",
  finishedAt: "2026-06-27T08:07:30.000Z",
  success: false,
  flagFound: false,
  toolCallsCount: 16,
  repeatedActionsCount: 5,
  humanInterventionsCount: 2,
  reportGenerated: false,
  totalTokens: 42_000,
  notes: ["sample baseline run"],
  isSampleData: true,
}

const penhub: BenchmarkRunResult = {
  runner: "penhub",
  caseId: "local-web-chain-001",
  model: "sample-model",
  startedAt: "2026-06-27T08:00:00.000Z",
  finishedAt: "2026-06-27T08:05:00.000Z",
  success: true,
  flagFound: true,
  timeToFlagSeconds: 240,
  toolCallsCount: 10,
  repeatedActionsCount: 1,
  failedBranchCount: 1,
  humanInterventionsCount: 0,
  evidenceItemsCount: 6,
  reportGenerated: true,
  reportReplayabilityScore: 0.8,
  totalTokens: 30_000,
  notes: ["sample PenHub run"],
  isSampleData: true,
}

describe("PenHub benchmark comparison", () => {
  test("computes fair deltas for matching sample runs", () => {
    const comparison = compareBenchmarkRuns({ baseline, penhub })

    expect(comparison.caseId).toBe("local-web-chain-001")
    expect(comparison.model).toBe("sample-model")
    expect(comparison.deltas.tokens).toBe(-12_000)
    expect(comparison.deltas.timeSeconds).toBe(-150)
    expect(comparison.deltas.toolCalls).toBe(-6)
    expect(comparison.deltas.repeatedActions).toBe(-4)
    expect(comparison.deltas.humanInterventions).toBe(-2)
    expect(comparison.isSampleData).toBe(true)
  })

  test("rejects comparisons across different cases or models", () => {
    expect(() =>
      compareBenchmarkRuns({
        baseline,
        penhub: { ...penhub, caseId: "other-case" },
      }),
    ).toThrow("same case")

    expect(() =>
      compareBenchmarkRuns({
        baseline,
        penhub: { ...penhub, model: "other-model" },
      }),
    ).toThrow("same model")

    expect(() =>
      compareBenchmarkRuns({
        baseline,
        penhub: { ...penhub, modelVariant: "high" },
      }),
    ).toThrow("same model variant")
  })

  test("renders sample-data disclaimers in benchmark reports", () => {
    const report = renderBenchmarkReport(compareBenchmarkRuns({ baseline, penhub }))

    expect(report).toContain("# PenHub Benchmark Report")
    expect(report).toContain("Sample fixture: yes")
    expect(report).toContain("No measured product claim")
    expect(report).toContain("| tokens_total | 42000 | 30000 | -12000 |")
  })
})
