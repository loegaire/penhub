# Local reverse benchmark 001

This is a controlled local benchmark case, not measured result data. The runner copies `workspace/` into a fresh temporary directory for every trial and evaluates the proposed result with `oracle.ts`.

Example matched runs:

```bash
bun run benchmarks/penhub/runners/run-case.ts --case benchmarks/penhub/cases/local-reverse-001/case.json --runner opencode-baseline --model provider/model --output .penhub/benchmark-runs/local-reverse-001 --trials 3
bun run benchmarks/penhub/runners/run-case.ts --case benchmarks/penhub/cases/local-reverse-001/case.json --runner penhub --model provider/model --output .penhub/benchmark-runs/local-reverse-001 --trials 3
bun run benchmarks/penhub/runners/compare-trials.ts .penhub/benchmark-runs/local-reverse-001/opencode-baseline .penhub/benchmark-runs/local-reverse-001/penhub
```
