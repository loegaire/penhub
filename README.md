# PenHub

PenHub is an OpenCode-derived runtime for CTF and local pentest lab workflows.

The goal is to keep OpenCode's strong CLI, app, server, session, and tool foundations, while changing the agent loop from generic coding assistance into a pentest-native state machine:

```text
Challenge
-> Facts
-> Hypotheses
-> Attack branches
-> Evidence
-> Failed attempts
-> Token budget
-> Compact state card
-> Next best action
```

PenHub is not a new platform around OpenCode. Phase 1 extends the existing OpenCode monorepo with typed actions, attack-state memory, observation compression, evidence-first reporting, and benchmark support.

## Current Branches

The active PenHub core branch is:

```text
codex/1-core-runtime
```

Remote layout:

```text
origin   https://github.com/kyrux29/PentHub.git
upstream https://github.com/anomalyco/opencode.git
```

Codex 2 and Codex 3 should branch from `origin/codex/1-core-runtime`, not raw upstream `dev`.

## Implemented Core

PenHub core runtime currently lives in:

```text
packages/core/src/penhub/**
packages/core/test/penhub/**
.opencode/tool/penhub-init-challenge.ts
.opencode/tool/penhub-state-card.ts
```

Implemented pieces:

- core PenHub challenge, fact, hypothesis, branch, evidence, token, and workspace state types
- JSONL-backed `.penhub/state` persistence
- compact PenHub State Card builder
- hypothesis lifecycle engine
- branch scoring, ranking, pruning, and next-branch selection
- token budget manager
- observation compression and artifact-backed raw output storage
- evidence recording and artifact hashing
- parsers for HTTP, ffuf JSON, and nuclei JSONL
- OpenCode custom tools for challenge init and state-card generation

## State Layout

PenHub creates local challenge state under:

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

Raw tool output must not be inserted directly into context. Store it as an artifact and pass compact summaries or evidence capsules into the model loop.

## Setup

This repo follows OpenCode's Bun-based workspace.

```bash
bun install
```

If Bun is not installed:

```bash
curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14"
```

## Validation

Fast PenHub validation:

```bash
cd packages/core
bun test test/penhub
bun typecheck
```

Full workspace typecheck:

```bash
bun run typecheck
```

Repository whitespace check:

```bash
git diff --check
```

## Parallel Codex Work

Read these before starting another agent:

- [PenHub Architecture](docs/penhub/architecture.md)
- [Agent Handoff](docs/penhub/agent-handoff.md)
- [Module Ownership](docs/penhub/module-ownership.md)
- [Codex 2 - Actions, Evidence, Replay, Report](docs/penhub/codex-2-actions-evidence-report.md)
- [Codex 3 - UI, Benchmark, Integration](docs/penhub/codex-3-ui-benchmark-integration.md)
- [Git Conflict Runbook](docs/penhub/git-conflict-runbook.md)
- [Deep Research Report](docs/penhub/deep-research-report%20(1).md)

Create separate worktrees:

```bash
git fetch origin
git worktree add ../penhub-worktrees/codex-2-actions -b codex/2-actions-evidence-report origin/codex/1-core-runtime
git worktree add ../penhub-worktrees/codex-3-ui-benchmark -b codex/3-ui-benchmark-integration origin/codex/1-core-runtime
```

Do not push to:

```text
main
dev
another agent's branch
```

## Phase 1 Constraints

Do not add these to runtime Phase 1 unless benchmark evidence proves they are needed:

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

Use OpenCode's existing packages and integration surfaces first.

## Upstream Attribution

PenHub is derived from OpenCode and keeps OpenCode's upstream architecture and package layout. OpenCode is maintained at:

```text
https://github.com/anomalyco/opencode
```

This fork is maintained for PenHub-specific CTF and local pentest runtime work.
