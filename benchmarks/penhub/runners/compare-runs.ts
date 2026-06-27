import { compareBenchmarkRuns, renderBenchmarkReport } from "../metrics/comparison"
import { parseBenchmarkRunResult } from "../metrics/schema"

const [baselinePath, penhubPath] = Bun.argv.slice(2)

if (!baselinePath || !penhubPath) {
  console.error("Usage: bun run benchmarks/penhub/runners/compare-runs.ts <baseline.json> <penhub.json>")
  process.exit(1)
}

const baseline = parseBenchmarkRunResult(await Bun.file(baselinePath).json())
const penhub = parseBenchmarkRunResult(await Bun.file(penhubPath).json())

console.log(renderBenchmarkReport(compareBenchmarkRuns({ baseline, penhub })))
