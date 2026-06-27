import type { PenHubBenchmarkSnapshot } from "../state/samplePenHubState"

export function BenchmarkComparisonPanel(props: { benchmark: PenHubBenchmarkSnapshot }) {
  return (
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3 text-[12px] text-v2-text-text-muted">
        <span>{props.benchmark.caseId}</span>
        <span>{props.benchmark.isSampleData ? "sample data" : "measured run"}</span>
      </div>
      <table class="w-full table-fixed text-[12px]">
        <thead class="text-left text-v2-text-text-muted">
          <tr>
            <th class="pb-2 font-medium">metric</th>
            <th class="pb-2 text-right font-medium">OpenCode</th>
            <th class="pb-2 text-right font-medium">PenHub</th>
            <th class="pb-2 text-right font-medium">delta</th>
          </tr>
        </thead>
        <tbody class="text-v2-text-text-base">
          <MetricRow label="success" baseline={props.benchmark.baseline.success} penhub={props.benchmark.penhub.success} />
          <MetricRow label="flag" baseline={props.benchmark.baseline.flagFound} penhub={props.benchmark.penhub.flagFound} />
          <MetricRow
            label="tokens"
            baseline={props.benchmark.baseline.totalTokens}
            penhub={props.benchmark.penhub.totalTokens}
            delta={props.benchmark.deltas.tokens}
          />
          <MetricRow
            label="tool calls"
            baseline={props.benchmark.baseline.toolCallsCount}
            penhub={props.benchmark.penhub.toolCallsCount}
            delta={props.benchmark.deltas.toolCalls}
          />
          <MetricRow
            label="repeats"
            baseline={props.benchmark.baseline.repeatedActionsCount}
            penhub={props.benchmark.penhub.repeatedActionsCount}
            delta={props.benchmark.deltas.repeatedActions}
          />
        </tbody>
      </table>
      <p class="text-[12px] leading-5 text-v2-text-text-muted">{props.benchmark.conclusion}</p>
    </div>
  )
}

function MetricRow(props: {
  label: string
  baseline: boolean | number
  penhub: boolean | number
  delta?: number
}) {
  return (
    <tr class="border-t border-v2-border-border-muted">
      <td class="py-2 text-v2-text-text-muted">{props.label}</td>
      <td class="py-2 text-right">{formatMetric(props.baseline)}</td>
      <td class="py-2 text-right">{formatMetric(props.penhub)}</td>
      <td class="py-2 text-right">{props.delta === undefined ? "n/a" : formatMetric(props.delta)}</td>
    </tr>
  )
}

function formatMetric(value: boolean | number) {
  if (typeof value === "boolean") return value ? "yes" : "no"
  return value.toLocaleString()
}
