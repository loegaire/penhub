export * as PenHubStateTools from "./penhub-state"

import { randomUUID } from "node:crypto"
import { ToolFailure } from "@opencode-ai/llm"
import { Effect, Layer, Schema } from "effect"
import { Location } from "../location"
import { buildStateCard } from "../penhub/context"
import { generateMarkdownReport } from "../penhub/report/markdown-report"
import { FileAttackStateStore } from "../penhub/state-store"
import { PermissionV2 } from "../permission"
import { Tool } from "./tool"
import { Tools } from "./tools"

const InitInput = Schema.Struct({
  name: Schema.String,
  type: Schema.Literals(["web", "crypto", "pwn", "rev", "misc", "cloud", "unknown"]),
  goal: Schema.String,
})

const RecordInput = Schema.Struct({
  kind: Schema.Literals(["fact", "hypothesis", "branch", "evidence", "failed_attempt"]),
  summary: Schema.String,
  detail: Schema.String.pipe(Schema.optional),
  confidence: Schema.Number.pipe(Schema.optional),
  status: Schema.String.pipe(Schema.optional),
  artifactPath: Schema.String.pipe(Schema.optional),
  branchId: Schema.String.pipe(Schema.optional),
  hypothesisId: Schema.String.pipe(Schema.optional),
  evidenceIds: Schema.Array(Schema.String).pipe(Schema.optional),
})

const EmptyInput = Schema.Struct({})
const Output = Schema.Struct({ message: Schema.String, id: Schema.String.pipe(Schema.optional) })

export const names = ["penhub_init", "penhub_record", "penhub_state", "penhub_report"] as const

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const location = yield* Location.Service
    const permission = yield* PermissionV2.Service
    const authorize = (name: (typeof names)[number], context: Tool.Context) =>
      permission.assert({
        action: name,
        resources: [location.directory],
        save: ["*"],
        sessionID: context.sessionID,
        agent: context.agent,
        source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
      })
    const failure = (name: string) =>
      Effect.mapError((error: unknown) =>
        new ToolFailure({ message: error instanceof Error ? error.message : `Unable to execute ${name}` }),
      )

    yield* tools
      .register({
        penhub_init: Tool.make({
          description: "Initialize durable PenHub attack state for the active security task.",
          input: InitInput,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* authorize("penhub_init", context)
              const id = `challenge_${randomUUID()}`
              yield* Effect.promise(() =>
                new FileAttackStateStore(location.directory).initChallenge({
                  id,
                  name: input.name,
                  type: input.type,
                  goal: input.goal,
                  workspacePath: location.directory,
                  createdAt: new Date().toISOString(),
                }),
              )
              return { message: "PenHub challenge state initialized.", id }
            }).pipe(failure("penhub_init")),
        }),
        penhub_record: Tool.make({
          description:
            "Record a compact fact, hypothesis, attack branch, evidence item, or failed attempt in durable PenHub state. Raw data belongs in .penhub/artifacts and should be referenced with artifactPath.",
          input: RecordInput,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* authorize("penhub_record", context)
              const store = new FileAttackStateStore(location.directory)
              const id = `${input.kind}_${randomUUID()}`
              const now = new Date().toISOString()
              if (input.kind === "fact")
                yield* Effect.promise(() =>
                  store.appendFact({
                    id,
                    source: "model",
                    claim: input.summary,
                    confidence: input.confidence ?? 0.5,
                    evidenceIds: [...(input.evidenceIds ?? [])],
                    branchId: input.branchId,
                    hypothesisId: input.hypothesisId,
                    createdAt: now,
                  }),
                )
              if (input.kind === "hypothesis")
                yield* Effect.promise(() =>
                  store.appendHypothesis({
                    id,
                    claim: input.summary,
                    status: hypothesisStatus(input.status),
                    requiredEvidence: [...(input.evidenceIds ?? [])],
                    nextTest: input.detail,
                    confidence: input.confidence ?? 0.5,
                    branchId: input.branchId,
                    createdAt: now,
                    updatedAt: now,
                  }),
                )
              if (input.kind === "branch")
                yield* Effect.promise(() =>
                  store.appendBranch({
                    id,
                    goal: input.summary,
                    status: branchStatus(input.status),
                    confidence: input.confidence ?? 0.5,
                    progress: 0,
                    novelty: 0.5,
                    tokenCost: 0,
                    repetitionPenalty: 0,
                    evidenceIds: [...(input.evidenceIds ?? [])],
                    hypothesisIds: input.hypothesisId ? [input.hypothesisId] : [],
                    createdAt: now,
                    updatedAt: now,
                  }),
                )
              if (input.kind === "evidence")
                yield* Effect.promise(() =>
                  store.appendEvidence({
                    id,
                    type: input.artifactPath ? "file" : "runtime",
                    summary: input.summary,
                    artifactPath: input.artifactPath,
                    supports: [...(input.evidenceIds ?? [])],
                    branchId: input.branchId,
                    hypothesisId: input.hypothesisId,
                    createdAt: now,
                  }),
                )
              if (input.kind === "failed_attempt")
                yield* Effect.promise(() =>
                  store.appendFailedAttempt({
                    id,
                    summary: input.summary,
                    reason: input.detail ?? "The attempted path did not produce supporting evidence.",
                    branchId: input.branchId,
                    hypothesisId: input.hypothesisId,
                    createdAt: now,
                  }),
                )
              return { message: `Recorded PenHub ${input.kind}.`, id }
            }).pipe(failure("penhub_record")),
        }),
        penhub_state: Tool.make({
          description: "Read the current compact PenHub state card.",
          input: EmptyInput,
          output: Output,
          toModelOutput: ({ output }) => [{ type: "text", text: output.message }],
          execute: (_input, context) =>
            Effect.gen(function* () {
              yield* authorize("penhub_state", context)
              return { message: yield* Effect.promise(() => buildStateCard({ workspacePath: location.directory })) }
            }).pipe(failure("penhub_state")),
        }),
        penhub_report: Tool.make({
          description: "Generate the current evidence-linked PenHub Markdown report.",
          input: EmptyInput,
          output: Output,
          execute: (_input, context) =>
            Effect.gen(function* () {
              yield* authorize("penhub_report", context)
              const report = yield* Effect.promise(() => generateMarkdownReport({ workspacePath: location.directory }))
              return { message: `Report generated at ${report.reportPath}.` }
            }).pipe(failure("penhub_report")),
        }),
      })
      .pipe(Effect.orDie)
  }),
)

function hypothesisStatus(value?: string) {
  if (value === "testing" || value === "confirmed" || value === "failed" || value === "stale") return value
  return "open" as const
}

function branchStatus(value?: string) {
  if (value === "active" || value === "blocked" || value === "confirmed" || value === "failed" || value === "stale")
    return value
  return "open" as const
}
