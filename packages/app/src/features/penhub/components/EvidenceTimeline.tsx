import { For, Show } from "solid-js"
import type { Evidence } from "@opencode-ai/core/penhub/index"

export function EvidenceTimeline(props: { evidence: Evidence[] }) {
  return (
    <ol class="space-y-3">
      <For each={props.evidence}>
        {(evidence) => (
          <li class="grid grid-cols-[88px_1fr] gap-3 border-b border-v2-border-border-muted pb-3 last:border-b-0 last:pb-0">
            <div class="text-[11px] uppercase tracking-normal text-v2-text-text-muted">{evidence.type}</div>
            <div class="min-w-0">
              <div class="text-[13px] leading-5 text-v2-text-text-base">{evidence.summary}</div>
              <div class="mt-1 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px] text-v2-text-text-muted">
                <span>{evidence.id}</span>
                <Show when={evidence.artifactPath}>
                  <span class="truncate">{evidence.artifactPath}</span>
                </Show>
                <Show when={evidence.hash}>
                  <span class="truncate">{evidence.hash}</span>
                </Show>
              </div>
            </div>
          </li>
        )}
      </For>
    </ol>
  )
}
