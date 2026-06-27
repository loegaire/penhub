# PenHub Git Conflict Runbook

This runbook is for Codex 2 and Codex 3 working in parallel.

## Golden Rules

- Start both branches from `origin/codex/1-core-runtime`.
- Never push directly to `main`, `dev`, or another Codex branch.
- Keep changes in owned paths.
- Add new PenHub-specific directories instead of editing broad OpenCode files.
- Do not reformat unrelated files.
- Do not commit `.GITHUB_TOKEN`, `.penhub/`, raw artifacts, or local benchmark outputs.

## Branch Setup

```bash
git fetch origin
git worktree add ../penhub-worktrees/codex-2-actions -b codex/2-actions-evidence-report origin/codex/1-core-runtime
git worktree add ../penhub-worktrees/codex-3-ui-benchmark -b codex/3-ui-benchmark-integration origin/codex/1-core-runtime
```

## Daily Sync

```bash
git status --short --branch
git fetch origin
git rebase origin/codex/1-core-runtime
```

If Codex 2 depends on a Codex 3 doc/CI change, rebase on that branch only after the dependency is explicit:

```bash
git fetch origin
git rebase origin/codex/3-ui-benchmark-integration
```

Avoid stacking branches unless necessary. Independent PRs are easier to merge.

## Before Push

```bash
git status --short
cd packages/core && bun test test/penhub && bun typecheck
cd ../.. && bun run typecheck && git diff --check
git push -u origin <branch>
```

If already pushed and rebased:

```bash
git push --force-with-lease origin <branch>
```

Do not use plain `--force`.

## Conflict Resolution

If conflict is in owned files:

```bash
git status
# resolve files
git add <resolved-files>
git rebase --continue
```

If conflict is in shared files:

1. Stop and identify the owner.
2. Keep the smaller change.
3. Move new code to a PenHub-specific subdirectory when possible.
4. Document the shared file change in the PR.
5. Run full typecheck.

## Shared File Change Template

```markdown
## Shared File Change
File:
Owner affected:
Reason:
Why this cannot live in an owned path:
Validation:
```

## Integration Order

Recommended merge order:

```text
1. codex/1-core-runtime
2. codex/2-actions-evidence-report
3. codex/3-ui-benchmark-integration
4. final integration branch, if needed
```

Codex 3 can merge after Codex 2 if UI depends on action/report outputs. If UI only uses fixtures or core state, Codex 3 can stay independent.

