export * as PenHubRunStore from "./store"

import { mkdir, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { Schema } from "effect"
import { appendJsonl, readJsonl } from "../jsonl"
import { statePaths } from "../state-paths"
import { Attempt, Lesson, RunState } from "./state"

export async function initialize(
  workspace: string,
  input: {
    goal: string
    sessionId: string
    maxAttempts?: number
    maxProviderTurns?: number
    maxTokens?: number
  },
) {
  const now = new Date().toISOString()
  const run: RunState = {
    version: 1,
    goal: input.goal,
    sessionId: input.sessionId,
    phase: "plan",
    milestoneIds: [],
    attemptCount: 0,
    providerTurns: 0,
    tokenCount: 0,
    lastDecisionAttemptCount: 0,
    noProgressTurns: 0,
    status: "active",
    branches: [],
    findings: [],
    budgets: {
      maxAttempts: input.maxAttempts ?? 50,
      maxProviderTurns: input.maxProviderTurns ?? 30,
      ...(input.maxTokens === undefined ? {} : { maxTokens: input.maxTokens }),
    },
    finalResponsePending: false,
    createdAt: now,
    updatedAt: now,
  }
  await mkdir(statePaths(workspace).state, { recursive: true })
  await write(workspace, run)
  await writeFile(statePaths(workspace).attempts, "", { flag: "w" })
  await writeFile(statePaths(workspace).lessons, "", { flag: "w" })
  return run
}

export async function read(workspace: string) {
  try {
    return Schema.decodeUnknownSync(RunState)(await Bun.file(statePaths(workspace).run).json())
  } catch (error) {
    if (errorCode(error) === "ENOENT") return undefined
    throw new Error(`Invalid PenHub run state: ${statePaths(workspace).run}`, { cause: error })
  }
}

export async function write(workspace: string, run: RunState) {
  const encoded = Schema.encodeSync(RunState)({ ...run, updatedAt: new Date().toISOString() })
  const target = statePaths(workspace).run
  const temporary = path.join(path.dirname(target), `.run-${crypto.randomUUID()}.tmp`)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(temporary, JSON.stringify(encoded, null, 2) + "\n")
  await rename(temporary, target)
}

export async function update(workspace: string, transform: (run: RunState) => RunState) {
  const run = await read(workspace)
  if (!run) return undefined
  const next = transform(run)
  await write(workspace, next)
  return next
}

export async function appendAttempt(workspace: string, attempt: Attempt) {
  const attempts = await listAttempts(workspace)
  if (attempts.some((item) => item.callId === attempt.callId)) return false
  await appendJsonl(statePaths(workspace).attempts, Schema.encodeSync(Attempt)(attempt))
  return true
}

export async function listAttempts(workspace: string) {
  return (await readJsonl(statePaths(workspace).attempts)).map((item) => Schema.decodeUnknownSync(Attempt)(item))
}

export async function appendLesson(workspace: string, lesson: Lesson) {
  await appendJsonl(statePaths(workspace).lessons, Schema.encodeSync(Lesson)(lesson))
}

export async function listLessons(workspace: string) {
  return (await readJsonl(statePaths(workspace).lessons)).map((item) => Schema.decodeUnknownSync(Lesson)(item))
}

function errorCode(error: unknown) {
  return error && typeof error === "object" ? Reflect.get(error, "code") : undefined
}
