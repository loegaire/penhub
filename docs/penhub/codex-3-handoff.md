# Codex 3 Handoff

Branch used for this implementation: `codex3-ui-benchmark`.

The codex-3 work stays in the OpenCode-derived monorepo and avoids Phase 1 external infrastructure. The UI reads fixture-backed PenHub attack state from `packages/app/src/features/penhub` and exposes it at `/penhub`. Benchmark logic is local-only and sample data remains marked with `isSampleData: true`.

## Owned Paths Changed

- `packages/app/src/features/penhub/**`
- `benchmarks/penhub/**`
- `harness/penhub/**`
- `scripts/penhub/**`
- `.github/workflows/penhub.yml`
- `.github/pull_request_template.md`
- `docs/penhub/codex-3-handoff.md`

## Validation Commands

```bash
cd packages/core && bun test test/penhub && bun typecheck
cd ../app && bun test --preload ./happydom.ts ./src/features/penhub/state
cd ../../benchmarks/penhub && bun test ./metrics/comparison.test.ts
cd ../../scripts/penhub && bun test ./ownership.test.ts
cd ../.. && bun run harness/penhub/smoke/smoke-run.ts
CODEX_ID=3 bun run scripts/penhub/check-ownership.ts
git diff --check
```

## Sample Data

The app fixture and benchmark fixtures are sample data only. They are not measured benchmark claims.
