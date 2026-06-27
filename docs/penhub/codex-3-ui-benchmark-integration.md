# Codex 3 - UI, Benchmark, Integration

Role: UI, Benchmark, GitHub Integration, and Conflict Guard Lead.

Branch:

```text
codex/3-ui-benchmark-integration
```

Base:

```text
origin/codex/1-core-runtime
```

## Mission

Build the visible PenHub experience and the benchmark harness around the core state runtime:

- UI panels for challenge, attack graph, hypotheses, evidence, token budget, failed branches, report preview, and benchmark comparison
- benchmark harness comparing upstream OpenCode against PenHub under fixed conditions
- CI and PR guardrails so Codex 1/2/3 can work without overwriting each other

Do not implement core/action logic unless there is a small import-only integration fix.

## Start Commands

```bash
git fetch origin
git worktree add ../penhub-worktrees/codex-3-ui-benchmark -b codex/3-ui-benchmark-integration origin/codex/1-core-runtime
cd ../penhub-worktrees/codex-3-ui-benchmark
git status --short --branch
```

## Owned Paths

Prefer new files under:

```text
packages/app/src/features/penhub/**
packages/app/src/**/penhub*
packages/opencode/src/server/**/penhub*
benchmarks/penhub/**
harness/penhub/**
scripts/penhub/**
docs/penhub/**
.github/**
```

Shared files allowed only when required:

```text
packages/app/src/app.tsx
packages/app/src/index.css
packages/app/vite.config.ts
packages/opencode/src/server/server.ts
packages/opencode/src/server/routes/**
package.json
bun.lock
AGENTS.md
README.md
```

Do not edit:

```text
packages/core/src/penhub/**
packages/core/test/penhub/**
.opencode/tool/penhub-*.ts
```

## UI Requirements

PenHub must not look like a generic chat wrapper. The first PenHub UI surface should focus on attack state:

```text
Challenge Overview
Attack Graph / Branch Explorer
Hypothesis Panel
Evidence Timeline
Token Budget Panel
Action Log
Failed Branches / Dead Ends
Report Preview
Benchmark Comparison Panel
```

Use existing OpenCode app patterns in `packages/app`. Do not create a separate standalone app unless explicitly approved.

Suggested structure:

```text
packages/app/src/features/penhub/
  PenHubWorkspace.tsx
  components/
    ChallengeOverview.tsx
    AttackGraphPanel.tsx
    BranchExplorer.tsx
    HypothesisPanel.tsx
    EvidenceTimeline.tsx
    TokenBudgetPanel.tsx
    ActionLogPanel.tsx
    FailedBranchesPanel.tsx
    ReportPreview.tsx
    BenchmarkComparisonPanel.tsx
  state/
    loadPenHubState.ts
    samplePenHubState.ts
```

If routing/server integration is needed, add a small PenHub route namespace instead of a new backend platform.

## Benchmark Requirements

Create a benchmark harness that keeps comparisons fair:

```text
same model
same target
same max wall-time
same token ceiling
same tool allowlist
same number of attempts
```

Metrics:

```text
solve_rate
time_to_first_valid_evidence
tokens_total
actions_total
tool_error_recovery_rate
evidence_density
report_completeness
unsafe_or_out_of_scope_attempts
```

Suggested structure:

```text
benchmarks/penhub/
  cases/
  runners/
    run-opencode-baseline.ts
    run-penhub.ts
    compare-runs.ts
  metrics/
  reports/
harness/penhub/
  fixtures/
  smoke/
```

All sample benchmark data must include:

```json
{ "isSampleData": true }
```

Never present sample data as measured product claims.

## GitHub / CI Guardrails

Codex 3 owns GitHub workflow and conflict guard work. Add only focused CI steps needed for PenHub:

```text
bun install
cd packages/core && bun test test/penhub
bun run typecheck
git diff --check
benchmark smoke, if implemented
```

Add PR template sections:

```markdown
## PenHub Ownership
Codex:
Owned paths changed:
Shared paths changed:

## Validation
Commands run:

## Benchmark Data
Sample data only:
Measured run:
```

## Tests

Minimum tests:

```text
packages/app/test-browser or package-local UI tests for PenHub components
benchmarks/penhub/** tests for comparison logic
harness/penhub/smoke/** smoke run
scripts/penhub/check-ownership.ts test or dry-run fixture
```

Required checks before push:

```bash
cd packages/core
bun test test/penhub
bun typecheck

cd ../..
bun run typecheck
git diff --check
```

Run app-level checks if UI files changed:

```bash
cd packages/app
bun typecheck
```

## PR / Handoff Checklist

- Branch is `codex/3-ui-benchmark-integration`.
- Rebased on `origin/codex/1-core-runtime`.
- No PenHub core/action implementation files touched without documented approval.
- UI uses existing OpenCode app patterns.
- Benchmark fixtures are marked `isSampleData: true`.
- CI changes are minimal and documented.
- Tests/typecheck pass.

