export * as InteractiveSession from "./interactive-session"

import { createWriteStream } from "node:fs"
import { randomUUID } from "node:crypto"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { finished } from "node:stream/promises"
import { PenHub } from "@opencode-ai/schema/penhub"
import { Effect, Option, Schema } from "effect"
import type { Pty } from "../../pty"
import { PtyID } from "../../pty/schema"
import { NonNegativeInt, PositiveInt } from "../../schema"
import { statePaths } from "../state-paths"
import { PenHubToolpack } from "../toolpack"
import { PenHubToolResult } from "./result-envelope"

const ReadLimit = PositiveInt.check(Schema.isLessThanOrEqualTo(50_000))

export const StartInput = Schema.Struct({
  pack: PenHub.ToolPackID,
  command: Schema.String.check(Schema.isMinLength(1)),
  args: Schema.Array(Schema.String),
  title: Schema.String.pipe(Schema.optional),
})

export const StartOutput = Schema.Struct({
  ...PenHubToolResult.Envelope.fields,
  sessionId: PtyID,
  pack: PenHub.ToolPackID,
  runtime: PenHubToolpack.Runtime,
  image: Schema.String,
  sessionStatus: Schema.Literals(["running", "exited"]),
  pid: NonNegativeInt,
  cursor: NonNegativeInt,
  artifactPath: Schema.String,
  exitCode: NonNegativeInt.pipe(Schema.optional),
})

export const WriteInput = Schema.Struct({
  sessionId: PtyID,
  data: Schema.String,
})

export const WriteOutput = Schema.Struct({
  ...PenHubToolResult.Envelope.fields,
  sessionId: PtyID,
  sessionStatus: Schema.Literals(["running", "exited"]),
  bytesWritten: NonNegativeInt,
  artifactPath: Schema.String,
})

export const ReadInput = Schema.Struct({
  sessionId: PtyID,
  cursor: NonNegativeInt.pipe(Schema.optional),
  limit: ReadLimit.pipe(Schema.optional),
})

export const ReadOutput = Schema.Struct({
  ...PenHubToolResult.Envelope.fields,
  sessionId: PtyID,
  sessionStatus: Schema.Literals(["running", "exited"]),
  output: Schema.String,
  cursor: NonNegativeInt,
  availableCursor: NonNegativeInt,
  truncated: Schema.Boolean,
  artifactPath: Schema.String,
  exitCode: NonNegativeInt.pipe(Schema.optional),
})

export const StopInput = Schema.Struct({ sessionId: PtyID })

export const StopOutput = Schema.Struct({
  ...PenHubToolResult.Envelope.fields,
  sessionId: PtyID,
  sessionStatus: Schema.Literal("stopped"),
  artifactPath: Schema.String,
  exitCode: NonNegativeInt.pipe(Schema.optional),
})

type Session = {
  readonly artifactPath: string
  readonly transcript: ReturnType<typeof createWriteStream>
  transcriptError?: Error
  attachment?: Pty.Attachment
}

export function make(input: {
  pty: Pty.Interface
  workspace: string
  prepare: (request: typeof StartInput.Type) => Effect.Effect<
    {
      command: string
      args: string[]
      runtime: PenHubToolpack.Runtime
      image: string
    },
    Error
  >
}) {
  const sessions = new Map<PtyID, Session>()

  const requireSession = (id: PtyID) => {
    const session = sessions.get(id)
    if (!session) throw new Error(`Unknown PenHub interactive session: ${id}`)
    return session
  }

  const start = Effect.fn("PenHubInteractiveSession.start")(function* (request: typeof StartInput.Type) {
    const started = performance.now()
    const command = yield* input.prepare(request)
    const artifactDirectory = path.join(statePaths(input.workspace).artifacts, "interactive-sessions")
    yield* Effect.promise(() => mkdir(artifactDirectory, { recursive: true }))
    const info = yield* input.pty.create({
      command: command.command,
      args: command.args,
      cwd: input.workspace,
      title: request.title ?? `${request.pack}: ${request.command}`,
    })
    const artifactPath = path.join(artifactDirectory, `${info.id}.log`)
    const session: Session = {
      artifactPath,
      transcript: createWriteStream(artifactPath),
    }
    session.transcript.on("error", (error) => {
      session.transcriptError = error
    })
    sessions.set(info.id, session)
    return yield* Effect.gen(function* () {
      const attachment = yield* input.pty
        .attach(info.id, {
          onData: (chunk) => session.transcript.write(chunk),
          onEnd: () => session.transcript.end(),
        })
        .pipe(Effect.option)
      if (Option.isSome(attachment)) {
        session.attachment = attachment.value
        session.transcript.write(attachment.value.replay)
        attachment.value.activate()
      }
      if (Option.isNone(attachment)) {
        session.transcript.end((yield* input.pty.read(info.id)).replay)
      }
      const current = yield* input.pty.get(info.id)
      const relativeArtifactPath = path.relative(input.workspace, artifactPath)
      return {
        id: `attempt_${randomUUID()}`,
        tool: "sec_session_start",
        status: "success" as const,
        summary: `Started persistent ${request.command} session ${info.id}.`,
        artifactPath: relativeArtifactPath,
        durationMs: Math.max(0, Math.round(performance.now() - started)),
        outputBytes: 0,
        sessionId: info.id,
        pack: request.pack,
        runtime: command.runtime,
        image: command.image,
        sessionStatus: current.status,
        pid: info.pid,
        cursor: (yield* input.pty.read(info.id)).cursor,
        ...(current.exitCode === undefined ? {} : { exitCode: current.exitCode }),
      }
    }).pipe(
      Effect.onError(() =>
        Effect.gen(function* () {
          yield* input.pty.remove(info.id).pipe(Effect.ignore)
          session.attachment?.detach()
          session.transcript.end()
          yield* Effect.promise(() => finished(session.transcript)).pipe(Effect.ignore)
          sessions.delete(info.id)
        }),
      ),
    )
  })

  const write = Effect.fn("PenHubInteractiveSession.write")(function* (request: typeof WriteInput.Type) {
    const started = performance.now()
    const session = requireSession(request.sessionId)
    const info = yield* input.pty.get(request.sessionId)
    if (info.status !== "running") throw new Error(`PenHub interactive session has exited: ${request.sessionId}`)
    yield* input.pty.write(request.sessionId, request.data)
    return {
      id: `attempt_${randomUUID()}`,
      tool: "sec_session_write",
      status: "success" as const,
      summary: `Wrote ${Buffer.byteLength(request.data)} bytes to ${request.sessionId}.`,
      durationMs: Math.max(0, Math.round(performance.now() - started)),
      outputBytes: 0,
      sessionId: request.sessionId,
      sessionStatus: "running" as const,
      bytesWritten: Buffer.byteLength(request.data),
      artifactPath: path.relative(input.workspace, session.artifactPath),
    }
  })

  const read = Effect.fn("PenHubInteractiveSession.read")(function* (request: typeof ReadInput.Type) {
    const started = performance.now()
    const session = requireSession(request.sessionId)
    const info = yield* input.pty.get(request.sessionId)
    const snapshot = yield* input.pty.read(request.sessionId, request.cursor)
    const output = snapshot.replay.slice(0, request.limit ?? 12_000)
    return {
      id: `attempt_${randomUUID()}`,
      tool: "sec_session_read",
      status: "success" as const,
      summary: output || "No new interactive-session output.",
      durationMs: Math.max(0, Math.round(performance.now() - started)),
      outputBytes: Buffer.byteLength(output),
      sessionId: request.sessionId,
      sessionStatus: info.status,
      output: output || "(no new output)",
      cursor: snapshot.startCursor + output.length,
      availableCursor: snapshot.cursor,
      truncated: snapshot.truncated || output.length < snapshot.replay.length,
      artifactPath: path.relative(input.workspace, session.artifactPath),
      ...(info.exitCode === undefined ? {} : { exitCode: info.exitCode }),
    }
  })

  const stop = Effect.fn("PenHubInteractiveSession.stop")(function* (request: typeof StopInput.Type) {
    const started = performance.now()
    const session = requireSession(request.sessionId)
    const info = yield* input.pty.get(request.sessionId)
    yield* input.pty.remove(request.sessionId)
    session.attachment?.detach()
    sessions.delete(request.sessionId)
    yield* Effect.promise(() => finished(session.transcript))
    if (session.transcriptError) throw session.transcriptError
    return {
      id: `attempt_${randomUUID()}`,
      tool: "sec_session_stop",
      status: "success" as const,
      summary: `Stopped persistent session ${request.sessionId}.`,
      durationMs: Math.max(0, Math.round(performance.now() - started)),
      outputBytes: 0,
      sessionId: request.sessionId,
      sessionStatus: "stopped" as const,
      artifactPath: path.relative(input.workspace, session.artifactPath),
      ...(info.exitCode === undefined ? {} : { exitCode: info.exitCode }),
    }
  })

  const close = () =>
    Effect.forEach(Array.from(sessions.keys()), (sessionId) => stop({ sessionId }).pipe(Effect.ignore), {
      discard: true,
    })

  return { start, write, read, stop, close }
}
