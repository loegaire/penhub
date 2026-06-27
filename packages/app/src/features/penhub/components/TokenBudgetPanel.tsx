import { For } from "solid-js"
import type { TokenUsage } from "@opencode-ai/core/penhub/index"

export function TokenBudgetPanel(props: { tokenUsage: TokenUsage }) {
  return (
    <div class="space-y-4">
      <div class="grid grid-cols-3 gap-3">
        <TokenMetric label="input" value={props.tokenUsage.totalInputTokens} />
        <TokenMetric label="output" value={props.tokenUsage.totalOutputTokens} />
        <TokenMetric label="total" value={props.tokenUsage.totalTokens} />
      </div>
      <div class="space-y-2">
        <For each={Object.entries(props.tokenUsage.byBranch)}>
          {([branch, tokens]) => (
            <div class="grid grid-cols-[minmax(0,1fr)_80px] items-center gap-3 text-[12px]">
              <span class="truncate text-v2-text-text-muted">{branch}</span>
              <span class="text-right text-v2-text-text-base">{tokens.toLocaleString()}</span>
            </div>
          )}
        </For>
      </div>
      <div class="text-[11px] text-v2-text-text-muted">
        compression ratio: {props.tokenUsage.compressionRatio ?? "n/a"}
      </div>
    </div>
  )
}

function TokenMetric(props: { label: string; value: number }) {
  return (
    <div class="min-w-0">
      <div class="text-[11px] uppercase tracking-normal text-v2-text-text-muted">{props.label}</div>
      <div class="mt-1 truncate text-[14px] font-semibold text-v2-text-text-base">{props.value.toLocaleString()}</div>
    </div>
  )
}
