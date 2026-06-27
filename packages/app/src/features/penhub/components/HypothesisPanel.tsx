import { For, Show } from "solid-js"
import type { Hypothesis } from "@opencode-ai/core/penhub/index"

export function HypothesisPanel(props: { hypotheses: Hypothesis[] }) {
  return (
    <div class="space-y-3">
      <For each={props.hypotheses}>
        {(hypothesis) => (
          <div class="border-b border-v2-border-border-muted pb-3 last:border-b-0 last:pb-0">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="truncate text-[13px] font-semibold text-v2-text-text-base">{hypothesis.id}</span>
                  <span class="shrink-0 rounded-sm bg-v2-background-bg-layer-03 px-1.5 py-0.5 text-[11px] text-v2-text-text-muted">
                    {hypothesis.status}
                  </span>
                </div>
                <p class="mt-1 text-[12px] leading-5 text-v2-text-text-muted">{hypothesis.claim}</p>
              </div>
              <span class="shrink-0 text-[12px] text-v2-text-text-muted">{Math.round(hypothesis.confidence * 100)}%</span>
            </div>
            <Show when={hypothesis.nextTest}>
              <p class="mt-2 text-[12px] leading-5 text-v2-text-text-base">{hypothesis.nextTest}</p>
            </Show>
            <div class="mt-2 text-[11px] text-v2-text-text-muted">
              required evidence: {hypothesis.requiredEvidence.join(", ") || "none"}
            </div>
          </div>
        )}
      </For>
    </div>
  )
}
