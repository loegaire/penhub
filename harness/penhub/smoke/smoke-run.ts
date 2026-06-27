import path from "node:path"
import { fileURLToPath } from "node:url"
import { compareBenchmarkRuns, renderBenchmarkReport } from "../../../benchmarks/penhub/metrics/comparison"
import { parseBenchmarkRunResult } from "../../../benchmarks/penhub/metrics/schema"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const baseline = parseBenchmarkRunResult(
  await Bun.file(path.join(root, "harness/penhub/fixtures/baseline-result.sample.json")).json(),
)
const penhub = parseBenchmarkRunResult(
  await Bun.file(path.join(root, "harness/penhub/fixtures/penhub-result.sample.json")).json(),
)

console.log(renderBenchmarkReport(compareBenchmarkRuns({ baseline, penhub })))
