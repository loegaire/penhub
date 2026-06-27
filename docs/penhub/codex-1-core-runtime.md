# Codex 1 - Core Runtime

Role: Core Runtime, Attack-State Memory, Context Builder, Hypothesis Engine, Attack Tree, and Token Budget Lead.

Branch:

```text
codex/1-core-runtime
```

Base:

```text
upstream/dev
```

Status: implemented and pushed to `origin/codex/1-core-runtime`.

## Mission

Codex 1 changes the core OpenCode loop from generic coding-agent context into PenHub's CTF/pentest-native operating state:

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

Codex 1 owns the state and planning primitives. It does not own typed action execution, report generation, UI, benchmark harness, or CI integration.

## Implemented Paths

```text
packages/core/src/penhub/types.ts
packages/core/src/penhub/state-paths.ts
packages/core/src/penhub/jsonl.ts
packages/core/src/penhub/state-store.ts
packages/core/src/penhub/context.ts
packages/core/src/penhub/hypothesis-engine.ts
packages/core/src/penhub/attack-tree.ts
packages/core/src/penhub/planner.ts
packages/core/src/penhub/budget.ts
packages/core/src/penhub/contracts.ts
packages/core/src/penhub/observation.ts
packages/core/src/penhub/evidence.ts
packages/core/src/penhub/validation.ts
packages/core/src/penhub/parsers/**
packages/core/src/penhub/index.ts
packages/core/test/penhub/**
.opencode/tool/penhub-init-challenge.ts
.opencode/tool/penhub-state-card.ts
```

## Core APIs

### State Store

`FileAttackStateStore` is the JSONL-backed attack state API.

Important methods:

```text
initChallenge(input)
readChallenge()
appendFact(fact)
listFacts(filter?)
appendHypothesis(hypothesis)
updateHypothesis(id, patch)
listHypotheses(filter?)
appendBranch(branch)
updateBranch(id, patch)
listBranches(filter?)
appendEvidence(evidence)
listEvidence(filter?)
appendFailedAttempt(attempt)
listFailedAttempts(filter?)
readWorkspaceState()
```

State layout:

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

### Context Builder

`buildStateCard(input)` and `renderStateCard(state, input)` produce compact Markdown for model context:

```text
# PenHub State Card
## Challenge
## Verified Facts
## Open Hypotheses
## Confirmed Primitives
## Failed / Stale Branches
## Failed Attempts
## Evidence Summary
## Token Budget
## Next Best Action Candidates
```

Rules:

- no raw long logs
- no full source files
- stable output for stable state
- limit facts, hypotheses, branches, and evidence by budget

### Hypothesis Engine

`HypothesisEngine` supports:

```text
create()
markTesting()
markConfirmed()
markFailed()
markStale()
```

Allowed lifecycle:

```text
open -> testing -> confirmed
open -> testing -> failed
open -> stale
testing -> stale
confirmed -> stale
failed -> stale
```

### Attack Tree

Branch scoring:

```text
score = confidence * 0.35
      + progress * 0.30
      + novelty * 0.20
      - normalizedTokenCost * 0.10
      - repetitionPenalty * 0.05
      + evidenceBoost
      - statusPenalty
```

Exports:

```text
scoreBranch()
rankBranches()
pruneBranches()
selectNextBranch()
```

### Planner Facade

`planNextAction(store)` combines:

```text
readWorkspaceState()
pruneBranches()
selectNextBranch()
```

It returns either:

```text
{ type: "continue", branch, reason }
{ type: "stop", reason }
```

### Token Budget

`TokenBudgetManager` tracks:

```text
totalInputTokens
totalOutputTokens
totalTokens
byBranch
byAction
byHypothesis
compressionRatio?
```

### Contracts

Zod contracts exist for the initial typed action surface:

```text
TargetRef
HttpProbeArgs
DirFuzzArgs
VulnerabilityScanArgs
ApiFuzzArgs
```

Codex 2 should extend these only when adding real typed actions.

## Existing Tests

```text
packages/core/test/penhub/state-store.test.ts
packages/core/test/penhub/state-validation.test.ts
packages/core/test/penhub/context.test.ts
packages/core/test/penhub/hypothesis-engine.test.ts
packages/core/test/penhub/attack-tree.test.ts
packages/core/test/penhub/budget.test.ts
packages/core/test/penhub/evidence.test.ts
packages/core/test/penhub/observation-parsers.test.ts
packages/core/test/penhub/planner.test.ts
```

Validated commands:

```bash
cd packages/core
bun test test/penhub
bun typecheck

cd ../..
bun run typecheck
bun run lint
git diff --check
```

## Codex 1 Follow-up Status

Completed in the Codex 1 hardening pass:

1. Stricter runtime validation for challenge, fact, hypothesis, branch, evidence, failed-attempt, and token-usage records.
2. Stable exact-output test for `renderStateCard`.
3. Failed-attempt store helpers for `failed_attempts.jsonl`.
4. Deterministic ID injection for `HypothesisEngine`, `recordEvidence`, and `compressObservation`.
5. Planner facade combining `readWorkspaceState`, `pruneBranches`, and `selectNextBranch`.
6. Compatibility tests for malformed JSONL, invalid persisted schema, and missing challenge state.

Remaining Codex 1 work should be limited to bug fixes or small compatibility additions discovered by Codex 2 or Codex 3.

Keep these changes inside:

```text
packages/core/src/penhub/**
packages/core/test/penhub/**
docs/penhub/codex-1-core-runtime.md
```

Do not move Codex 2 action/report logic into Codex 1 files.

## Handoff To Codex 2

Codex 2 should reuse:

```text
FileAttackStateStore
TokenBudgetManager
recordEvidence
compressObservation
contracts.ts schemas
parsers/**
```

Codex 2 should add action runtime/report code in new subdirectories instead of rewriting Codex 1 state primitives.

## Handoff To Codex 3

Codex 3 should read structured state through:

```text
FileAttackStateStore.readWorkspaceState()
renderStateCard()
```

Codex 3 should use fixtures or sample state for UI until Codex 2 action/report output is merged.

## PR / Handoff Checklist

- Branch is `codex/1-core-runtime`.
- No unrelated OpenCode README/locale/doc churn.
- No Codex 2 action/report implementation added here.
- No Codex 3 UI/benchmark/CI implementation added here.
- PenHub tests pass.
- Core typecheck passes.
- Root typecheck passes before push.
