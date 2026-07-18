import path from "node:path"

export type StatePaths = {
  root: string
  state: string
  artifacts: string
  tmp: string
  challenge: string
  facts: string
  hypotheses: string
  branches: string
  evidence: string
  failedAttempts: string
  tokenUsage: string
  report: string
  run: string
  attempts: string
  lessons: string
}

export function statePaths(workspacePath: string): StatePaths {
  const root = path.join(workspacePath, ".penhub")
  const state = path.join(root, "state")
  return {
    root,
    state,
    artifacts: path.join(root, "artifacts"),
    tmp: path.join(root, "tmp"),
    challenge: path.join(state, "challenge.json"),
    facts: path.join(state, "facts.jsonl"),
    hypotheses: path.join(state, "hypotheses.jsonl"),
    branches: path.join(state, "branches.jsonl"),
    evidence: path.join(state, "evidence.jsonl"),
    failedAttempts: path.join(state, "failed_attempts.jsonl"),
    tokenUsage: path.join(state, "token_usage.json"),
    report: path.join(state, "report.md"),
    run: path.join(state, "run.json"),
    attempts: path.join(state, "attempts.jsonl"),
    lessons: path.join(state, "lessons.jsonl"),
  }
}
