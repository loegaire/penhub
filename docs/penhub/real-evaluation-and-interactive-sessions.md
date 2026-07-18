# Real Evaluation and Interactive Sessions

PenHub's first research-grounded architecture increment stays inside the existing OpenCode runtime. It adds a controlled local evaluation path and four canonical tools backed by the existing Location-scoped PTY service:

```text
sec_session_start
sec_session_write
sec_session_read
sec_session_stop
```

Interactive commands run inside the selected OCI utility pack. Process state survives model turns, reads use absolute cursors and bounded output, and the complete terminal transcript is retained under `.penhub/artifacts/interactive-sessions/`.

## Controlled evaluation

Each benchmark case has a `case.json`, an isolated workspace, an executable oracle, and ordered milestones. `run-case.ts` copies the workspace into a fresh temporary directory for each trial, runs the OpenCode CLI in JSON event mode, preserves the trace and artifacts, evaluates the candidate, and repeats the oracle against a clean workspace.

Use a fresh output path for each experiment. The runner refuses to overwrite an existing trial directory so traces from separate controlled runs cannot be mixed accidentally.

Run matched trials with the same model and optional model variant:

```bash
bun run benchmarks/penhub/runners/run-case.ts \
  --case benchmarks/penhub/cases/local-reverse-001/case.json \
  --runner opencode-baseline \
  --model provider/model \
  --variant high \
  --output .penhub/benchmark-runs/local-reverse-001 \
  --trials 3

bun run benchmarks/penhub/runners/run-case.ts \
  --case benchmarks/penhub/cases/local-reverse-001/case.json \
  --runner penhub \
  --model provider/model \
  --variant high \
  --output .penhub/benchmark-runs/local-reverse-001 \
  --trials 3
```

Then render the multi-trial comparison:

```bash
bun run benchmarks/penhub/runners/compare-trials.ts \
  .penhub/benchmark-runs/local-reverse-001/opencode-baseline \
  .penhub/benchmark-runs/local-reverse-001/penhub \
  .penhub/benchmark-runs/local-reverse-001/report.md
```

The comparison includes pass estimates, median duration and token/tool metrics, repeated actions, tool errors, reproduction rate, and milestone reach. The included local reverse case is controlled benchmark input, not measured result data. No product claim should be made until matched model trials have actually been executed.
