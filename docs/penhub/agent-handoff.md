# PenHub Agent Handoff

This repository is now an OpenCode fork with PenHub core runtime on branch:

```text
codex/1-core-runtime
```

Remote layout:

```text
origin   https://github.com/kyrux29/PentHub.git
upstream https://github.com/anomalyco/opencode.git
```

Do not build a separate platform around OpenCode. Continue extending the OpenCode monorepo.

## Current State

Codex 1 has landed the core PenHub runtime in:

```text
packages/core/src/penhub/**
packages/core/test/penhub/**
.opencode/tool/penhub-init-challenge.ts
.opencode/tool/penhub-state-card.ts
docs/penhub/architecture.md
```

Validated checks:

```bash
cd packages/core
bun test test/penhub
bun typecheck

cd ../..
bun run typecheck
bun run lint
git diff --check
```

## Branch Base For Next Agents

Codex 2 and Codex 3 must branch from the pushed PenHub core branch, not from raw upstream `dev`.

```bash
git fetch origin
git fetch upstream
git worktree add ../penhub-worktrees/codex-2-actions -b codex/2-actions-evidence-report origin/codex/1-core-runtime
git worktree add ../penhub-worktrees/codex-3-ui-benchmark -b codex/3-ui-benchmark-integration origin/codex/1-core-runtime
```

If a branch already exists locally:

```bash
git worktree add ../penhub-worktrees/codex-2-actions codex/2-actions-evidence-report
git worktree add ../penhub-worktrees/codex-3-ui-benchmark codex/3-ui-benchmark-integration
```

## Standard Loop

Before coding:

```bash
git status --short --branch
git fetch origin
git rebase origin/codex/1-core-runtime
```

Before pushing:

```bash
git status --short
bun run typecheck
git diff --check
git push -u origin <your-branch>
```

Use narrower tests while iterating:

```bash
cd packages/core
bun test test/penhub
bun typecheck
```

Use `--force-with-lease` only after a rebase of your own branch:

```bash
git push --force-with-lease origin <your-branch>
```

Never push to:

```text
main
dev
codex/1-core-runtime
another agent's branch
```

## Token Safety

`.GITHUB_TOKEN` is local-only. It must never be committed, pasted into docs, stored in a remote URL, or included in command output.

