# PenHub Architecture

PenHub is an OpenCode-derived runtime, not a platform wrapped around OpenCode.

Phase 1 changes the inner loop by adding CTF/pentest-native state primitives inside the existing OpenCode monorepo:

- core PenHub types live in `packages/core/src/penhub/types.ts`
- attack-state persistence is JSONL-backed under `.penhub/state`
- raw or long tool output is stored under `.penhub/artifacts`, then compressed before it enters context
- compact state cards are produced by `packages/core/src/penhub/context.ts`
- hypothesis lifecycle, branch scoring, pruning, and token accounting are implemented in `packages/core/src/penhub`
- typed action contracts are Zod schemas in `packages/core/src/penhub/contracts.ts`

Do not add FastAPI, PostgreSQL, Redis, Temporal, MinIO, or vector databases for Phase 1. OpenCode already provides the CLI, server, sessions, tools, and app surfaces that PenHub should extend.

## State Layout

When PenHub starts a challenge, it creates:

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

Facts should stay short and evidence-backed. Long stdout, HTTP bodies, fuzzing output, and logs should be stored as artifacts and summarized into observations.

## Next Integration Points

The next changes should wire these core modules into OpenCode surfaces instead of building separate infrastructure:

- custom tools in OpenCode's tool/plugin system for `http_probe`, `dir_fuzz`, `vuln_scan`, `api_fuzz`, `state_update`, `evidence_capture`, and `report_generate`
- optional server namespace for UI/harness reads, such as `/penhub/session/:id/state`
- app panels inside `packages/app` for attack graph, hypotheses, evidence, token budget, and report preview
- benchmark harness that compares upstream OpenCode against PenHub with the same model, target, wall time, and token ceiling

## Parallel Agent Docs

Use these docs before starting the next agents:

- `docs/penhub/agent-handoff.md`
- `docs/penhub/module-ownership.md`
- `docs/penhub/codex-2-actions-evidence-report.md`
- `docs/penhub/codex-3-ui-benchmark-integration.md`
- `docs/penhub/git-conflict-runbook.md`
