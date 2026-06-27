import type { PenHubWorkspaceFixture } from "../state/samplePenHubState"
import type { createPenHubDashboardSummary } from "../state/dashboard-summary"

export function ChallengeOverview(props: {
  fixture: PenHubWorkspaceFixture
  summary: ReturnType<typeof createPenHubDashboardSummary>
}) {
  return (
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Metric label="Challenge" value={props.summary.challengeName} />
      <Metric label="Type" value={props.fixture.workspace.challenge.type} />
      <Metric label="Evidence" value={String(props.summary.evidenceItems)} />
      <Metric label="Tokens" value={props.summary.tokensTotal.toLocaleString()} />
      <div class="md:col-span-2 xl:col-span-4">
        <p class="text-[13px] leading-5 text-v2-text-text-muted">{props.fixture.workspace.challenge.goal}</p>
        <p class="mt-2 truncate text-[12px] text-v2-text-text-muted">{props.fixture.workspace.challenge.workspacePath}</p>
      </div>
    </div>
  )
}

function Metric(props: { label: string; value: string }) {
  return (
    <div class="min-w-0 border-l-2 border-v2-icon-icon-accent pl-3">
      <div class="text-[11px] uppercase tracking-normal text-v2-text-text-muted">{props.label}</div>
      <div class="mt-1 truncate text-[16px] font-semibold text-v2-text-text-base">{props.value}</div>
    </div>
  )
}
