import path from "node:path"
import { fileURLToPath } from "node:url"
import { compareBenchmarkRuns, renderBenchmarkReport } from "../../../benchmarks/penhub/metrics/comparison"
import type { BenchmarkRunResult } from "../../../benchmarks/penhub/metrics/schema"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const baseline = (await Bun.file(path.join(root, "harness/penhub/fixtures/baseline-result.sample.json")).json()) as BenchmarkRunResult
const penhub = (await Bun.file(path.join(root, "harness/penhub/fixtures/penhub-result.sample.json")).json()) as BenchmarkRunResult

console.log(renderBenchmarkReport(compareBenchmarkRuns({ baseline, penhub })))
