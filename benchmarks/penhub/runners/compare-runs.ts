import { compareBenchmarkRuns, renderBenchmarkReport } from "../metrics/comparison"
import type { BenchmarkRunResult } from "../metrics/schema"

const [baselinePath, penhubPath] = Bun.argv.slice(2)

if (!baselinePath || !penhubPath) {
  console.error("Usage: bun run benchmarks/penhub/runners/compare-runs.ts <baseline.json> <penhub.json>")
  process.exit(1)
}

const baseline = (await Bun.file(baselinePath).json()) as BenchmarkRunResult
const penhub = (await Bun.file(penhubPath).json()) as BenchmarkRunResult

console.log(renderBenchmarkReport(compareBenchmarkRuns({ baseline, penhub })))
