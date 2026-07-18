# PenHub DeepSeek Flash Evaluation Log

This file is the decision record for PenHub harness experiments. Raw traces and trial artifacts are stored under `.penhub/benchmark-runs/deepseek-flash/`. A code revision is retained only when its single new controlled run improves the previous retained result; otherwise the revision is reverted.

## Fixed comparison frame

| Field | Value |
| --- | --- |
| Model | `opencode/deepseek-v4-flash-free` |
| Model variant | Provider default |
| User prompt | Exactly `solve this challenge` |
| Case | `local-cross-domain-001` |
| Domains in one case | Web interaction, source analysis, cryptographic derivation, traffic inspection |
| Trials | One new PenHub trial per significant revision |
| Before result | The previous retained revision's recorded trial; it is not rerun |
| Wall-time limit | 300 seconds per trial |
| Output-token ceiling | 8,000 per provider turn |
| Permissions | Non-interactive runner with skip-permission mode |
| Environment | Fresh copied workspace and fresh OpenCode config directory per trial |
| Completion | Candidate must pass `oracle.ts`; replay must pass against a second clean workspace |
| Primary metrics | Verified completion, highest milestone, replay, duration, tokens, tool calls, tool errors, repeated action fingerprints |

The challenge, model, prompt, limits, and runner stay fixed between retained revisions. The challenge intentionally joins domains because ordinary technical investigations cross domain boundaries and a single composite run conserves the limited model allocation.

The one-run protocol cannot estimate run-to-run variance, `pass@k`, or statistical significance. Keep/revert decisions are therefore directional development decisions. Verified completion and replay dominate efficiency metrics; milestones diagnose incomplete runs; duration and token differences are treated cautiously.

## Research interpretation frame

Each experiment is assessed against these predictions from the architecture brief:

- EnIGMA and SWE-agent: better agent-computer interfaces should improve useful interaction and reduce repeated setup.
- PentestGPT and PentestEval: explicit global state and stage-level progress should make failures more diagnosable.
- Anthropic's context and harness guidance: added harness components must justify themselves through empirical evaluation, and active context should remain compact.
- Cybench, AutoPenBench, and ExploitBench: executable checks and intermediate milestones should be distinguished from tool activity and textual claims.
- Reflexion and ExpeL: reflection or retained experience should be added only after reliable evaluation exists.

## Excluded preflight - reverse-only fixture

Status: excluded by protocol revision. These runs are retained for auditability but are not a before result and will not influence any architecture decision.

Three OpenCode-baseline trials completed before the benchmark was redirected to a composite case. No matching PenHub trials were run.

| Trial | Verified | Replay | Duration to result | Tokens | Tools | Errors | Repeats | Highest milestone |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | yes | yes | 98 s | 159,452 | 6 | 0 | 0 | `candidate-verified` |
| 2 | yes | yes | 88 s | 159,583 | 6 | 0 | 0 | `candidate-verified` |
| 3 | yes | yes | 24 s | 143,024 | 4 | 0 | 0 | `candidate-verified` |

Personal observation: the reported token total accumulates provider-turn input, output, reasoning, and cache-read usage. The large totals show repeated context processing even though the output ceiling is 8,000 per provider turn. This supports measuring focused context and token use, but the excluded reverse-only data says nothing about whether one PenHub revision is better than another.

## Experiment 001 - Composite current-best before run

Status: pending.

### Change under test

Establish the retained comparison point for the current implementation. The case requires the model to connect a captured request, server-side proof logic, a cryptographic derivation, and a live HTTP request. Persistent PTY tools are available but are not required by construction.

### Command

```bash
bun run benchmarks/penhub/runners/run-case.ts --case benchmarks/penhub/cases/local-cross-domain-001/case.json --runner penhub --model opencode/deepseek-v4-flash-free --output .penhub/benchmark-runs/deepseek-flash/composite-001-before --trials 1
```

### Results

Pending.

### Personal observations and source alignment

Pending trace review.

### Decision

Pending controlled result.
