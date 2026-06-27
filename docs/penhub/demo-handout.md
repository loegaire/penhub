# PenHub Demo Handout

Last verified: 2026-06-27 on branch `codex/2-actions-evidence-report`.

Current baseline:

```text
origin/codex/1-core-runtime plus Codex 2 action/evidence/replay/report implementation
```

## 1. Setup

Run from repo root:

```bash
cd /home/kyrux/Downloads/PentHub
git fetch origin
git checkout codex/2-actions-evidence-report
export PATH=/home/kyrux/.bun/bin:$PATH
```

If `bun` is already in your shell profile, the `PATH` line is optional.

## 2. Health Checks

Use this before demo:

```bash
cd /home/kyrux/Downloads/PentHub
export PATH=/home/kyrux/.bun/bin:$PATH

cd packages/core
bun test test/penhub
bun typecheck
cd ../..

bunx oxlint packages/core/src/penhub packages/core/test/penhub
bun run typecheck
git diff --check
```

Expected result:

```text
PenHub tests: 28 pass, 0 fail
Scoped PenHub lint: 0 warnings, 0 errors
Root typecheck: 29 successful, 29 total
git diff --check: no output
```

## 3. Manual Runtime Smoke Test

Create a disposable PenHub workspace:

```bash
export DEMO_WS="$(mktemp -d /tmp/penhub-demo-XXXXXX)"
echo "$DEMO_WS"
```

Seed attack state, render the State Card, and ask the planner for the next branch:

```bash
bun --cwd packages/core --eval '
import {
  FileAttackStateStore,
  buildStateCard,
  planNextAction,
  writeTokenUsage,
} from "./src/penhub/index.ts"

const workspacePath = process.env.DEMO_WS
if (!workspacePath) throw new Error("DEMO_WS is missing")

const createdAt = "2026-06-27T00:00:00.000Z"
const store = new FileAttackStateStore(workspacePath)

await store.initChallenge({
  id: "challenge_demo",
  name: "PenHub Demo Target",
  type: "web",
  goal: "Find the fastest validated path to a flag-like primitive.",
  workspacePath,
  createdAt,
})

await store.appendFact({
  id: "fact_login",
  source: "runtime",
  claim: "The target exposes /login and /admin routes.",
  confidence: 0.9,
  evidenceIds: ["ev_http"],
  branchId: "br_login",
  createdAt,
})

await store.appendHypothesis({
  id: "hyp_auth",
  claim: "Authentication bypass may exist through weak role checks.",
  status: "testing",
  requiredEvidence: ["ev_http"],
  nextTest: "Probe /admin with low-privilege session headers.",
  confidence: 0.65,
  branchId: "br_login",
  createdAt,
  updatedAt: createdAt,
})

await store.appendBranch({
  id: "br_login",
  goal: "Validate auth bypass on /admin.",
  status: "active",
  confidence: 0.82,
  progress: 0.7,
  novelty: 0.55,
  tokenCost: 1200,
  repetitionPenalty: 0.05,
  evidenceIds: ["ev_http"],
  hypothesisIds: ["hyp_auth"],
  createdAt,
  updatedAt: createdAt,
})

await store.appendBranch({
  id: "br_wordlist",
  goal: "Run broad wordlist fuzzing.",
  status: "stale",
  confidence: 0.2,
  progress: 0.1,
  novelty: 0.2,
  tokenCost: 9000,
  repetitionPenalty: 0.8,
  evidenceIds: [],
  hypothesisIds: [],
  createdAt,
  updatedAt: createdAt,
})

await store.appendEvidence({
  id: "ev_http",
  type: "http",
  summary: "GET /admin returns 302 for anonymous users and 200 with a low-privilege cookie.",
  supports: ["fact_login", "hyp_auth"],
  branchId: "br_login",
  hypothesisId: "hyp_auth",
  createdAt,
})

await store.appendFailedAttempt({
  id: "fail_bruteforce",
  summary: "Tried default credential guesses.",
  reason: "Repeated attempts returned fixed 401 responses.",
  branchId: "br_wordlist",
  actionId: "http_probe",
  createdAt,
})

await writeTokenUsage(workspacePath, {
  totalInputTokens: 420,
  totalOutputTokens: 120,
  totalTokens: 540,
  byBranch: { br_login: 540 },
  byAction: { http_probe: 540 },
  byHypothesis: { hyp_auth: 540 },
})

console.log("WORKSPACE", workspacePath)
console.log(await buildStateCard({ workspacePath, maxFacts: 5, maxHypotheses: 5, maxBranches: 5, maxEvidence: 5 }))
console.log("PLANNER", JSON.stringify(await planNextAction(store), null, 2))
'
```

Expected demo signals:

```text
# PenHub State Card
## Challenge
## Verified Facts
## Open Hypotheses
## Failed Attempts
## Next Best Action Candidates
PLANNER ... "type": "continue" ... "id": "br_login"
```

Inspect persisted state:

```bash
find "$DEMO_WS/.penhub" -maxdepth 3 -type f | sort
sed -n '1,80p' "$DEMO_WS/.penhub/state/challenge.json"
sed -n '1,80p' "$DEMO_WS/.penhub/state/facts.jsonl"
sed -n '1,80p' "$DEMO_WS/.penhub/state/failed_attempts.jsonl"
sed -n '1,80p' "$DEMO_WS/.penhub/state/token_usage.json"
```

## 4. Manual Validation Check

This should fail fast because confidence must be between 0 and 1:

```bash
bun --cwd packages/core --eval '
import { FileAttackStateStore } from "./src/penhub/index.ts"
const workspacePath = process.env.DEMO_WS
if (!workspacePath) throw new Error("DEMO_WS is missing")
const store = new FileAttackStateStore(workspacePath)
try {
  await store.appendFact({
    id: "fact_bad",
    source: "manual",
    claim: "Invalid confidence should be rejected.",
    confidence: 2,
    evidenceIds: [],
    createdAt: "2026-06-27T00:00:00.000Z",
  })
  throw new Error("Validation unexpectedly passed")
} catch (error) {
  console.log(error instanceof Error ? error.message : String(error))
}
'
```

Expected output:

```text
Invalid PenHub fact: confidence must be between 0 and 1
```

## 5. Demo Talk Track

Use this flow for a short demo:

1. Show `docs/penhub/deep-research-report (1).md` for the product direction: PenHub turns OpenCode into a CTF/pentest agent with planner, typed tools, attack state, evidence, and report.
2. Show `docs/penhub/codex-1-core-runtime.md` for Codex1 ownership and completed follow-up status.
3. Run the health checks.
4. Run the smoke test and show `.penhub/state/*`.
5. Explain that the State Card is compact context for the model: facts, hypotheses, failed attempts, evidence, token usage, and next action candidates.
6. Explain that `planNextAction()` is intentionally small now: it reads workspace state, prunes stale/failed branches, ranks candidates, and returns the next branch for Codex2 action execution.

## 6. Demo Pass Criteria

The demo is ready if:

```text
PenHub tests pass.
Core and root typecheck pass.
Scoped PenHub lint has 0 warnings.
Smoke test creates .penhub/state files.
State Card includes failed attempts and next action candidates.
Planner returns br_login as the next branch.
Invalid state write is rejected with a clear validation error.
```

## 7. Known Boundaries

Codex1 currently owns state, validation, context, budget, parsers, hypothesis lifecycle, attack tree, and planner facade.

Codex1 does not yet implement:

```text
typed action execution
report generation pipeline
UI panels
benchmark harness
CI integration
```

Those are Codex2/Codex3 handoff areas.
