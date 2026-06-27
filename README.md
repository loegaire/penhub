# PenHub

PenHub is an OpenCode fork focused on CTF and authorized local pentest lab workflows.

It keeps OpenCode's CLI, app, server, session, package, and plugin foundations, then adds a PenHub runtime layer for attack-state memory, typed actions, evidence capture, replay, and report generation.

PenHub is not a separate platform wrapped around OpenCode. The Phase 1 strategy is to extend the existing monorepo in-place and keep the control plane simple.

## Runtime Model

PenHub turns the agent loop into a structured security workflow:

```text
Challenge
-> Facts
-> Hypotheses
-> Attack branches
-> Evidence
-> Failed attempts
-> Token budget
-> Compact state card
-> Typed action
-> Replayable report
```

Long logs and raw tool output do not go directly into model context. They are written under `.penhub/artifacts`, compressed into observations, linked as evidence, and summarized through the PenHub State Card.

## Current Status

Phase 1 core runtime is implemented on:

```text
origin/codex/1-core-runtime
```

Codex 2 action/evidence/report work is implemented on:

```text
codex/2-actions-evidence-report
```

Implemented PenHub capabilities:

- JSONL-backed attack state under `.penhub/state`
- challenge, fact, hypothesis, branch, evidence, failed-attempt, and token-usage validation
- compact State Card rendering
- hypothesis lifecycle engine
- attack-tree scoring, pruning, and planner facade
- typed action registry and runner
- safe local actions for source inspection, route/input/sink extraction, localhost HTTP probing, response comparison, log inspection, evidence capture, hypothesis update, and report generation
- artifact-backed evidence recorder with SHA-256 hashing
- replay-step builder from structured state
- Markdown report generator
- OpenCode custom tools for PenHub init, state-card rendering, HTTP probe, directory probe, static scan, API input mapping, evidence capture, and report generation
- focused PenHub test coverage under `packages/core/test/penhub`

## Repository Layout

PenHub runtime code lives in:

```text
packages/core/src/penhub/**
packages/core/test/penhub/**
.opencode/tool/penhub-*.ts
docs/penhub/**
```

Important docs:

- [Architecture](docs/penhub/architecture.md)
- [Agent Handoff](docs/penhub/agent-handoff.md)
- [Codex 1 Core Runtime](docs/penhub/codex-1-core-runtime.md)
- [Codex 2 Actions, Evidence, Replay, Report](docs/penhub/codex-2-actions-evidence-report.md)
- [Codex 3 UI, Benchmark, Integration](docs/penhub/codex-3-ui-benchmark-integration.md)
- [Demo Handout](docs/penhub/demo-handout.md)
- [Git Conflict Runbook](docs/penhub/git-conflict-runbook.md)
- [Deep Research Report](<docs/penhub/deep-research-report%20(1).md>)

## State Layout

Initializing a challenge creates:

```text
.penhub/
  state/
    challenge.json
    facts.jsonl
    hypotheses.jsonl
    branches.jsonl
    evidence.jsonl
    failed_attempts.jsonl
    token_usage.json
    report.md
  artifacts/
  tmp/
```

This directory is local runtime state. Do not commit generated `.penhub/` data unless a future fixture explicitly requires it.

## Quickstart

Install dependencies:

```bash
bun install
```

If Bun is missing:

```bash
curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14"
export PATH="$HOME/.bun/bin:$PATH"
```

Run focused PenHub checks:

```bash
cd packages/core
bun test test/penhub
bun typecheck
```

Run workspace checks from repo root:

```bash
bun run typecheck
bunx oxlint packages/core/src/penhub packages/core/test/penhub
git diff --check
```

## Manual Demo

Use the demo handout:

```bash
sed -n '1,240p' docs/penhub/demo-handout.md
```

The handout includes:

- health-check commands
- a disposable `.penhub` workspace smoke test
- State Card rendering
- planner decision output
- validation failure check
- demo talk track and pass criteria

## OpenCode Tools

PenHub tool wrappers live under `.opencode/tool`:

```text
penhub-init-challenge.ts
penhub-state-card.ts
penhub-http-probe.ts
penhub-dir-fuzz.ts
penhub-vuln-scan.ts
penhub-api-fuzz.ts
penhub-evidence-capture.ts
penhub-report-generate.ts
```

The network-facing wrappers are intentionally localhost-oriented for Phase 1. Tests must not depend on external network access.

## Branch Discipline

Remote layout:

```text
origin   https://github.com/kyrux29/PentHub.git
upstream https://github.com/anomalyco/opencode.git
```

Recommended branch bases:

```text
codex/1-core-runtime              -> origin/codex/1-core-runtime
codex/2-actions-evidence-report   -> origin/codex/1-core-runtime
codex/3-ui-benchmark-integration  -> origin/codex/1-core-runtime
```

Do not push PenHub work to `dev`, `main`, or another agent's branch. Use separate worktrees when multiple agents work in parallel.

## Phase 1 Constraints

Avoid adding infrastructure unless benchmark evidence proves it is needed:

```text
FastAPI
PostgreSQL
Redis
Temporal
MinIO
vector databases
external LLM calls in tests
network-only tests
```

Use OpenCode's existing runtime, package, plugin, CLI, and app surfaces first.

## Scope And Safety

PenHub is intended for CTFs, local labs, and authorized assessment workflows. Repository fixtures and tests must not include real exploit payloads, external network scans, credential abuse, or uncontrolled destructive behavior.

## Upstream Attribution

PenHub is derived from OpenCode and keeps its monorepo architecture and package layout. OpenCode is maintained at:

```text
https://github.com/anomalyco/opencode
```

This fork is maintained for PenHub-specific CTF and local pentest runtime work.
