import { createResource, Show } from "solid-js"
import { PanelShell } from "./components/PanelShell"
import { ChallengeOverview } from "./components/ChallengeOverview"
import { AttackGraphPanel } from "./components/AttackGraphPanel"
import { HypothesisPanel } from "./components/HypothesisPanel"
import { EvidenceTimeline } from "./components/EvidenceTimeline"
import { TokenBudgetPanel } from "./components/TokenBudgetPanel"
import { ActionLogPanel } from "./components/ActionLogPanel"
import { FailedBranchesPanel } from "./components/FailedBranchesPanel"
import { ReportPreview } from "./components/ReportPreview"
import { BenchmarkComparisonPanel } from "./components/BenchmarkComparisonPanel"
import { createPenHubDashboardSummary } from "./state/dashboard-summary"
import { loadPenHubState } from "./state/loadPenHubState"
import { PenHubPanelTitle } from "./state/panels"

export default function PenHubWorkspace() {
  const [fixture] = createResource(loadPenHubState)

  return (
    <main class="min-h-dvh bg-v2-background-bg-base text-v2-text-text-base">
      <Show
        when={fixture()}
        keyed
        fallback={<div class="p-6 text-[13px] text-v2-text-text-muted">Loading PenHub state...</div>}
      >
        {(data) => {
          const summary = createPenHubDashboardSummary(data.workspace)

          return (
            <div class="mx-auto flex w-full max-w-[1680px] flex-col gap-4 px-4 py-4 lg:px-6">
              <header class="flex flex-wrap items-end justify-between gap-4 border-b border-v2-border-border-muted pb-4">
                <div class="min-w-0">
                  <div class="text-[12px] uppercase tracking-normal text-v2-text-text-muted">PenHub</div>
                  <h1 class="mt-1 truncate text-[22px] font-semibold text-v2-text-text-base">
                    {data.workspace.challenge.name}
                  </h1>
                </div>
                <div class="flex flex-wrap gap-2 text-[12px] text-v2-text-text-muted">
                  <span class="rounded-sm bg-v2-background-bg-layer-01 px-2 py-1">
                    {data.isSampleData ? "sample data" : "live state"}
                  </span>
                  <span class="rounded-sm bg-v2-background-bg-layer-01 px-2 py-1">
                    next: {summary.nextBranch?.id ?? "none"}
                  </span>
                </div>
              </header>

              <PanelShell title={PenHubPanelTitle.challengeOverview} meta={data.workspace.challenge.type}>
                <ChallengeOverview fixture={data} summary={summary} />
              </PanelShell>

              <div class="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <PanelShell title={PenHubPanelTitle.attackGraph} meta={`${data.workspace.branches.length} branches`}>
                  <AttackGraphPanel branches={data.workspace.branches} />
                </PanelShell>
                <PanelShell title={PenHubPanelTitle.hypotheses} meta={`${summary.openHypotheses} open`}>
                  <HypothesisPanel hypotheses={data.workspace.hypotheses} />
                </PanelShell>
              </div>

              <div class="grid gap-4 xl:grid-cols-[1fr_360px]">
                <PanelShell title={PenHubPanelTitle.evidenceTimeline} meta={`${data.workspace.evidence.length} items`}>
                  <EvidenceTimeline evidence={data.workspace.evidence} />
                </PanelShell>
                <PanelShell title={PenHubPanelTitle.tokenBudget} meta={`${summary.tokensTotal.toLocaleString()} used`}>
                  <TokenBudgetPanel tokenUsage={data.workspace.tokenUsage} />
                </PanelShell>
              </div>

              <div class="grid gap-4 xl:grid-cols-2">
                <PanelShell title={PenHubPanelTitle.actionLog} meta={`${data.actions.length} actions`}>
                  <ActionLogPanel actions={data.actions} />
                </PanelShell>
                <PanelShell
                  title={PenHubPanelTitle.failedBranches}
                  meta={`${summary.failedBranches + summary.staleBranches} closed`}
                >
                  <FailedBranchesPanel branches={data.workspace.branches} evidence={data.workspace.evidence} />
                </PanelShell>
              </div>

              <div class="grid gap-4 xl:grid-cols-[1fr_420px]">
                <PanelShell title={PenHubPanelTitle.reportPreview}>
                  <ReportPreview markdown={data.reportMarkdown} />
                </PanelShell>
                <PanelShell title={PenHubPanelTitle.benchmarkComparison} meta={data.benchmark.model}>
                  <BenchmarkComparisonPanel benchmark={data.benchmark} />
                </PanelShell>
              </div>
            </div>
          )
        }}
      </Show>
    </main>
  )
}
