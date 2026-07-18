import { readdir } from "node:fs/promises"
import path from "node:path"
import { aggregateBenchmarkRuns, renderAggregateComparison } from "../metrics/aggregate"
import { parseBenchmarkRunResult } from "../metrics/schema"

const [baselineDirectory, penhubDirectory, output] = Bun.argv.slice(2)
if (!baselineDirectory || !penhubDirectory) {
  console.error("Usage: bun run compare-trials.ts <baseline-directory> <penhub-directory> [report.md]")
  process.exit(1)
}

const baseline = aggregateBenchmarkRuns(await load(path.resolve(baselineDirectory)))
const penhub = aggregateBenchmarkRuns(await load(path.resolve(penhubDirectory)))
const report = renderAggregateComparison(baseline, penhub)
if (output) await Bun.write(path.resolve(output), report)
console.log(report)

async function load(directory: string) {
  const files = (await readdir(directory, { recursive: true }))
    .filter((file) => file.endsWith("result.json"))
    .toSorted()
  if (files.length === 0) throw new Error(`No result.json files found under ${directory}`)
  return Promise.all(
    files.map(async (file) => parseBenchmarkRunResult(await Bun.file(path.join(directory, file)).json())),
  )
}
