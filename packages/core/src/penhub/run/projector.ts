export * as PenHubAttemptProjector from "./projector"

import { createHash } from "node:crypto"
import { DateTime, Effect, Layer } from "effect"
import { EventV2 } from "../../event"
import { Location } from "../../location"
import { SessionEvent } from "../../session/event"
import { PenHubRunStore } from "./store"
import type { Attempt, AttemptStatus } from "./state"

type Called = {
  sessionId: string
  tool: string
  input: Record<string, unknown>
  startedAt: string
}

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const events = yield* EventV2.Service
    const location = yield* Location.Service
    const calls = new Map<string, Called>()
    const unsubscribe = yield* events.listen((event) => {
      if (event.location?.directory !== location.directory) return Effect.void
      if (event.type === SessionEvent.Tool.Called.type) {
        const data = event.data as typeof SessionEvent.Tool.Called.data.Type
        calls.set(data.callID, {
          sessionId: data.sessionID,
          tool: data.tool,
          input: data.input,
          startedAt: iso(data.timestamp),
        })
        return Effect.void
      }
      if (event.type === SessionEvent.Step.Ended.type) {
        const data = event.data as typeof SessionEvent.Step.Ended.data.Type
        return Effect.promise(() =>
          PenHubRunStore.update(location.directory, (run) => {
            if (run.sessionId !== data.sessionID) return run
            return {
              ...run,
              providerTurns: run.providerTurns + 1,
              tokenCount:
                run.tokenCount +
                data.tokens.input +
                data.tokens.output +
                data.tokens.reasoning +
                data.tokens.cache.read +
                data.tokens.cache.write,
            }
          }),
        ).pipe(Effect.asVoid)
      }
      if (event.type !== SessionEvent.Tool.Success.type && event.type !== SessionEvent.Tool.Failed.type) {
        return Effect.void
      }
      const data = event.data as typeof SessionEvent.Tool.Success.data.Type | typeof SessionEvent.Tool.Failed.data.Type
      const called = calls.get(data.callID)
      calls.delete(data.callID)
      if (!called) return Effect.void
      return Effect.promise(async () => {
        const run = await PenHubRunStore.read(location.directory)
        if (!run || run.sessionId !== called.sessionId) return
        const success = event.type === SessionEvent.Tool.Success.type
        const observation = success
          ? summarizeSuccess(data as typeof SessionEvent.Tool.Success.data.Type)
          : summarizeFailure(data as typeof SessionEvent.Tool.Failed.data.Type)
        const artifactPath = success ? findArtifact(data as typeof SessionEvent.Tool.Success.data.Type) : undefined
        const reportedStatus = success
          ? (data as typeof SessionEvent.Tool.Success.data.Type).structured.status
          : undefined
        const status: AttemptStatus =
          reportedStatus === "success" || reportedStatus === "error" || reportedStatus === "timeout"
            ? reportedStatus
            : success
              ? "success"
              : /timed?\s*out|timeout/i.test(observation)
                ? "timeout"
                : "error"
        const finishedAt = iso(data.timestamp)
        const branchId = controlTool(called.tool) ? undefined : run.activeBranchId
        const structured = success ? (data as typeof SessionEvent.Tool.Success.data.Type).structured : undefined
        const reportedDuration = structured?.durationMs
        const reportedBytes = structured?.outputBytes
        const attempt: Attempt = {
          id: `attempt_${data.callID}`,
          sessionId: called.sessionId,
          callId: data.callID,
          ...(branchId === undefined ? {} : { branchId }),
          tool: called.tool,
          normalizedArgsHash: hash(stableJson(called.input)),
          status,
          observation,
          observationHash: hash(`${status}:${observation}`),
          ...(artifactPath === undefined ? {} : { artifactPath }),
          startedAt: called.startedAt,
          finishedAt,
          durationMs:
            typeof reportedDuration === "number" && Number.isSafeInteger(reportedDuration) && reportedDuration >= 0
              ? reportedDuration
              : Math.max(0, Date.parse(finishedAt) - Date.parse(called.startedAt)),
          outputBytes:
            typeof reportedBytes === "number" && Number.isSafeInteger(reportedBytes) && reportedBytes >= 0
              ? reportedBytes
              : Buffer.byteLength(observation),
        }
        if (!(await PenHubRunStore.appendAttempt(location.directory, attempt))) return
        await PenHubRunStore.update(location.directory, (current) => ({
          ...current,
          attemptCount: current.attemptCount + 1,
          reflectionPendingBranchId:
            attempt.branchId === current.reflectionPendingBranchId ? undefined : current.reflectionPendingBranchId,
          branches: current.branches.map((branch) =>
            branch.id === attempt.branchId
              ? { ...branch, attempts: branch.attempts + 1, updatedAt: finishedAt }
              : branch,
          ),
        }))
      })
    })
    yield* Effect.addFinalizer(() => unsubscribe)
  }),
)

function summarizeSuccess(data: typeof SessionEvent.Tool.Success.data.Type) {
  const structured = JSON.stringify(data.structured)
  const content = data.content
    .map((item) => (item.type === "text" ? item.text : item.type === "file" ? `[file: ${item.name ?? item.mime}]` : ""))
    .filter(Boolean)
    .join("\n")
  return clip(content || structured || "Tool completed without model-facing output.", 2_000)
}

function summarizeFailure(data: typeof SessionEvent.Tool.Failed.data.Type) {
  return clip(data.error.message, 2_000)
}

function findArtifact(data: typeof SessionEvent.Tool.Success.data.Type) {
  const artifact = data.structured.artifactPath
  if (typeof artifact === "string") return artifact
  return data.outputPaths?.[0]
}

function clip(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim()
  return normalized.length <= limit ? normalized : normalized.slice(0, limit - 3).trimEnd() + "..."
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (!value || typeof value !== "object") return JSON.stringify(value) ?? "undefined"
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(",")}}`
}

function iso(value: DateTime.Utc) {
  return new Date(DateTime.toEpochMillis(value)).toISOString()
}

function controlTool(tool: string) {
  return [
    "penhub_init",
    "penhub_branch",
    "record_hypothesis",
    "penhub_record",
    "penhub_reflect",
    "penhub_state",
    "penhub_report",
  ].includes(tool)
}
