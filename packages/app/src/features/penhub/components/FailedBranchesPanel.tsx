import { For } from "solid-js"
import type { Branch, Evidence } from "@opencode-ai/core/penhub/index"

export function FailedBranchesPanel(props: { branches: Branch[]; evidence: Evidence[] }) {
  const failedBranches = () => props.branches.filter((branch) => branch.status === "failed" || branch.status === "stale")

  return (
    <div class="space-y-3">
      <For each={failedBranches()}>
        {(branch) => (
          <div class="border-b border-v2-border-border-muted pb-3 last:border-b-0 last:pb-0">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-[13px] font-semibold text-v2-text-text-base">{branch.goal}</div>
                <div class="mt-1 text-[12px] text-v2-text-text-muted">{branch.status}</div>
              </div>
              <span class="shrink-0 text-[11px] text-v2-text-text-muted">{branch.tokenCost.toLocaleString()} tokens</span>
            </div>
            <p class="mt-2 text-[12px] leading-5 text-v2-text-text-muted">{evidenceSummary(branch, props.evidence)}</p>
          </div>
        )}
      </For>
    </div>
  )
}

function evidenceSummary(branch: Branch, evidence: Evidence[]) {
  return evidence.find((item) => branch.evidenceIds.includes(item.id))?.summary ?? "No evidence recorded."
}
