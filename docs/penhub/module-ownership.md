# PenHub Module Ownership

These ownership rules are for parallel Codex work. They are stricter than normal engineering ownership so the branches can be pushed independently without repeated merge conflicts.

## Codex 1 - Core Runtime

Status: implemented on `codex/1-core-runtime`.

Detailed guide:

```text
docs/penhub/codex-1-core-runtime.md
```

Owned paths:

```text
packages/core/src/penhub/types.ts
packages/core/src/penhub/state-paths.ts
packages/core/src/penhub/jsonl.ts
packages/core/src/penhub/state-store.ts
packages/core/src/penhub/context.ts
packages/core/src/penhub/hypothesis-engine.ts
packages/core/src/penhub/attack-tree.ts
packages/core/src/penhub/budget.ts
packages/core/test/penhub/state-store.test.ts
packages/core/test/penhub/context.test.ts
packages/core/test/penhub/hypothesis-engine.test.ts
packages/core/test/penhub/attack-tree.test.ts
packages/core/test/penhub/budget.test.ts
```

Do not rewrite these from Codex 2 or Codex 3 unless there is a documented integration bug.

## Codex 2 - Actions, Evidence, Replay, Report

Primary branch:

```text
codex/2-actions-evidence-report
```

Allowed paths:

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
docs/penhub/codex-2-actions-evidence-report.md
```

Shared files Codex 2 may touch with care:

```text
packages/core/src/penhub/contracts.ts
packages/core/src/penhub/evidence.ts
packages/core/src/penhub/observation.ts
packages/core/src/penhub/parsers/**
packages/core/src/penhub/index.ts
.opencode/tool/penhub-state-card.ts
```

If Codex 2 touches shared files, the PR must include:

```markdown
## Shared File Change
File:
Reason:
Compatibility impact:
Tests:
```

Codex 2 must not touch:

```text
packages/app/**
packages/opencode/src/server/**
benchmarks/**
harness/**
.github/**
```

## Codex 3 - UI, Benchmark, Integration

Primary branch:

```text
codex/3-ui-benchmark-integration
```

Allowed paths:

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

Shared files Codex 3 may touch with care:

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

Codex 3 must not modify PenHub core implementation except for import-only integration fixes:

```text
packages/core/src/penhub/**
packages/core/test/penhub/**
.opencode/tool/penhub-*.ts
```

## Conflict Rules

- New code should go in new PenHub-specific subdirectories when possible.
- Do not rename existing OpenCode files unless unavoidable.
- Do not reformat unrelated files.
- Do not update `bun.lock` unless a new dependency is truly required.
- Prefer OpenCode's existing dependencies before adding new ones.
- If two agents need the same shared file, one agent should open a small integration PR first, then the other rebases.
