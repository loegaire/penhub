import { For } from "solid-js"
import type { Branch } from "@opencode-ai/core/penhub/index"

export function AttackGraphPanel(props: { branches: Branch[] }) {
  return (
    <div class="space-y-3">
      <For each={props.branches}>
        {(branch) => (
          <div class="min-w-0 border-b border-v2-border-border-muted pb-3 last:border-b-0 last:pb-0">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="truncate text-[13px] font-semibold text-v2-text-text-base">{branch.id}</span>
                  <span class="shrink-0 rounded-sm bg-v2-background-bg-layer-03 px-1.5 py-0.5 text-[11px] text-v2-text-text-muted">
                    {branch.status}
                  </span>
                </div>
                <p class="mt-1 text-[12px] leading-5 text-v2-text-text-muted">{branch.goal}</p>
              </div>
              <span class="shrink-0 text-[12px] text-v2-text-text-muted">{Math.round(branch.confidence * 100)}%</span>
            </div>
            <div class="mt-2 h-1.5 overflow-hidden rounded-sm bg-v2-background-bg-layer-03">
              <div class="h-full bg-v2-icon-icon-accent" style={{ width: `${Math.round(branch.progress * 100)}%` }} />
            </div>
            <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-v2-text-text-muted">
              <span>{branch.evidenceIds.length} evidence</span>
              <span>{branch.hypothesisIds.length} hypotheses</span>
              <span>{branch.tokenCost.toLocaleString()} tokens</span>
            </div>
          </div>
        )}
      </For>
    </div>
  )
}
