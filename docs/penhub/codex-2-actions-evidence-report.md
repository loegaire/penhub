# Codex 2 - Actions, Evidence, Replay, Report

Role: Actions, Evidence, Replay, and Report Lead.

Branch:

```text
codex/2-actions-evidence-report
```

Base:

```text
origin/codex/1-core-runtime
```

Status: implemented on `codex/2-actions-evidence-report`.

## Mission

Implement the typed action layer that makes PenHub behave like a disciplined CTF or local pentest agent:

- actions have typed inputs and short typed outputs
- raw output is stored under `.penhub/artifacts`
- observations are compressed before entering model context
- evidence capsules link to facts, branches, and hypotheses
- reports are generated from state/evidence, not from chat transcript

Do not implement real exploit payloads. Keep actions safe for local CTF/lab workflows.

## Implemented Paths

```text
packages/core/src/penhub/action-runtime/**
packages/core/src/penhub/actions/**
packages/core/src/penhub/report/**
packages/core/src/penhub/replay/**
packages/core/test/penhub/action-runtime/**
packages/core/test/penhub/actions/**
packages/core/test/penhub/report/**
packages/core/test/penhub/replay/**
packages/core/test/penhub/evidence-recorder.test.ts
.opencode/tool/penhub-http-probe.ts
.opencode/tool/penhub-dir-fuzz.ts
.opencode/tool/penhub-vuln-scan.ts
.opencode/tool/penhub-api-fuzz.ts
.opencode/tool/penhub-evidence-capture.ts
.opencode/tool/penhub-report-generate.ts
```

## Implemented Actions

The default registry includes:

```text
inspect_tree
summarize_files
extract_routes
extract_inputs
extract_sinks
run_local_app
send_request
compare_responses
inspect_logs
record_evidence
update_hypothesis
generate_report
dir_fuzz
```

`send_request` and `dir_fuzz` are localhost-only. Static scanning actions do not execute payloads.

## Start Commands

```bash
git fetch origin
git worktree add ../penhub-worktrees/codex-2-actions -b codex/2-actions-evidence-report origin/codex/1-core-runtime
cd ../penhub-worktrees/codex-2-actions
git status --short --branch
```

## Owned Paths

Prefer new files under:

```text
packages/core/src/penhub/action-runtime/**
packages/core/src/penhub/actions/**
packages/core/src/penhub/report/**
packages/core/src/penhub/replay/**
packages/core/src/penhub/action-parsers/**
packages/core/test/penhub/action-runtime/**
packages/core/test/penhub/actions/**
packages/core/test/penhub/report/**
packages/core/test/penhub/replay/**
.opencode/tool/penhub-http-probe.ts
.opencode/tool/penhub-dir-fuzz.ts
.opencode/tool/penhub-vuln-scan.ts
.opencode/tool/penhub-api-fuzz.ts
.opencode/tool/penhub-evidence-capture.ts
.opencode/tool/penhub-report-generate.ts
```

Shared files allowed only when necessary:

```text
packages/core/src/penhub/contracts.ts
packages/core/src/penhub/evidence.ts
packages/core/src/penhub/observation.ts
packages/core/src/penhub/parsers/**
packages/core/src/penhub/index.ts
```

Do not edit UI, benchmark, CI, or server route files.

## Required Work

1. Action registry and runner

Create a PenHub action manifest and runner with these concepts:

```text
name
description
riskLevel: read-only | local-exec | network-local | manual
inputSchema
outputSchema
run(input)
```

2. Core actions

Implement typed actions:

```text
inspect_tree
summarize_files
extract_routes
extract_inputs
extract_sinks
run_local_app
send_request
compare_responses
inspect_logs
record_evidence
update_hypothesis
generate_report
```

Keep output short. Store raw or long output as artifacts. Return `compressedSummary` for context.

3. Evidence recorder

Evidence must include:

```text
id
type
summary
artifactPath?
hash?
supports[]
branchId?
hypothesisId?
createdAt
```

Use SHA-256 when an artifact exists. Append evidence through `FileAttackStateStore`.

4. Replay builder

Generate replay steps from confirmed branches and evidence. Replay steps must be human-readable and must not depend on hidden transcript state.

5. Markdown report generator

Generate report sections:

```text
Summary
Challenge
Final Result / Flag
Attack Chain
Evidence Table
Replay Steps
Failed Branches
Token Usage
Human Effort
Appendix
```

6. OpenCode custom tools

Add `.opencode/tool/penhub-*.ts` tools that call the PenHub action runtime. Tool results must be compact and must not dump raw logs into chat context.

## Safety Rules

- No external network calls in tests.
- No real exploit payloads in repository fixtures.
- No raw logs in state card.
- No dependencies unless OpenCode already has a suitable package missing.
- Do not write to `.penhub/` in committed fixtures except explicit test tempdirs.

## Tests

Minimum tests:

```text
packages/core/test/penhub/action-runtime/action-registry.test.ts
packages/core/test/penhub/actions/inspect-tree.test.ts
packages/core/test/penhub/actions/send-request.test.ts
packages/core/test/penhub/evidence-recorder.test.ts
packages/core/test/penhub/replay/replay-builder.test.ts
packages/core/test/penhub/report/markdown-report.test.ts
```

Current PenHub test suite includes Codex 1 and Codex 2 coverage:

```text
28 tests across 15 files
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

## PR / Handoff Checklist

- Branch is `codex/2-actions-evidence-report`.
- Rebased on `origin/codex/1-core-runtime`.
- No UI/benchmark/CI files touched.
- Raw action output is artifact-backed and compressed.
- Evidence links to branch/hypothesis where applicable.
- Reports are generated from structured state.
- Tests pass.
