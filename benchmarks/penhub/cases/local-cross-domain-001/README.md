# Local cross-domain benchmark 001

This is a controlled local benchmark case, not measured result data. It combines traffic inspection, source analysis, a small cryptographic derivation, and interaction with a live HTTP service. The model sees only a fresh copy of `workspace/`; the expected result remains outside that workspace.

The benchmark prompt is intentionally fixed at exactly `solve this challenge`. A retained PenHub run is the comparison point for the next significant harness change, so the token-conserving development protocol needs one new trial per revision rather than rerunning the previous revision.

```bash
bun run benchmarks/penhub/runners/run-case.ts --case benchmarks/penhub/cases/local-cross-domain-001/case.json --runner penhub --model opencode/deepseek-v4-flash-free --output .penhub/benchmark-runs/deepseek-flash/composite-001-before --trials 1
```
