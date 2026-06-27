import { For, Show } from "solid-js"
import type { PenHubActionLogItem } from "../state/samplePenHubState"

export function ActionLogPanel(props: { actions: PenHubActionLogItem[] }) {
  return (
    <div class="space-y-3">
      <For each={props.actions}>
        {(action) => (
          <div class="border-b border-v2-border-border-muted pb-3 last:border-b-0 last:pb-0">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <span class="truncate text-[13px] font-semibold text-v2-text-text-base">{action.action}</span>
                <span class="ml-2 rounded-sm bg-v2-background-bg-layer-03 px-1.5 py-0.5 text-[11px] text-v2-text-text-muted">
                  {action.status}
                </span>
              </div>
              <span class="shrink-0 text-[11px] text-v2-text-text-muted">{action.durationSeconds}s</span>
            </div>
            <p class="mt-1 text-[12px] leading-5 text-v2-text-text-muted">{action.summary}</p>
            <div class="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px] text-v2-text-text-muted">
              <span>{action.branchId}</span>
              <Show when={action.hypothesisId}>
                <span>{action.hypothesisId}</span>
              </Show>
              <Show when={action.artifactPath}>
                <span class="truncate">{action.artifactPath}</span>
              </Show>
            </div>
          </div>
        )}
      </For>
    </div>
  )
}
