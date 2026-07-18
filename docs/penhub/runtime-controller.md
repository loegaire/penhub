# PenHub Runtime Controller

PenHub now extends the existing OpenCode Session V2 loop with one bounded, workspace-local security run. It does not introduce another queue, database, permission service, or model loop.

## Control flow

```text
Session V2 provider turn
  -> primary operator action
  -> canonical Tool.make settlement
  -> automatic attempt projector
  -> branch-specific task card
  -> continue | reflect once | switch | verify | report
```

An active run requires an action on every provider turn. The controller allows at most three open branches, requests reflection after two repeated actions or observations, allows one post-reflection retry, and then switches to the next queued branch. Action, provider-turn, and optional token budgets terminate the loop deterministically. Solved, blocked, and budget-exhausted runs receive one final text-only reporting turn.

## Durable state

The compact controller state is stored under the existing workspace-local `.penhub` directory:

```text
.penhub/state/run.json
.penhub/state/attempts.jsonl
.penhub/state/lessons.jsonl
```

Session V2 remains the authoritative event history. The attempt projector listens to durable tool-call and settlement events and records the tool, normalized argument hash, bounded observation, status, artifact path, timing, and active branch automatically. Model output is never promoted directly to a verified finding.

## One tool plane

The live tools all use OpenCode's canonical registry:

```text
raw OCI tools                 sec_nmap, sec_gdb, sec_sage, ...
persistent interactive tools sec_session_start/read/write/stop
semantic tools               inspect_tree, summarize_files, compare_responses
run tools                    penhub_branch, record_hypothesis, penhub_reflect
evidence tools               penhub_artifact_read, verify_candidate
```

Raw and interactive security tools return the standard attempt envelope (`id`, `tool`, `status`, `exitCode`, `summary`, `artifactPath`, `durationMs`, and `outputBytes`) while preserving tool-specific fields. The older typed action registry is no longer exported as PenHub's public execution path.

## Verification boundary

`verify_candidate` can mark a run solved only when a trusted exact-digest or command oracle accepts. Oracle configuration is injected outside model-controlled workspace state through `PENHUB_ORACLE_SHA256` or a read-only wrapper at `PENHUB_ORACLE_COMMAND`; neither the oracle nor the expected result is stored in `run.json`. The model-callable `penhub_init` tool cannot configure an oracle, preventing the operator from defining its own success condition or using verification as an execution-permission bypass. A rejected candidate moves the run to reflection and retains the verifier output under `.penhub/artifacts/verifications/`.

The system context contains only the active branch, its last three attempts, relevant lessons and artifact paths, verified findings, queued alternatives, and remaining budgets. Raw output stays in artifacts and is retrieved through bounded head, tail, line, or grep reads.
