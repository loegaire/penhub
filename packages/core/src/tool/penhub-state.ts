export * as PenHubStateTools from "./penhub-state"

import { randomUUID } from "node:crypto"
import { ToolFailure } from "@opencode-ai/llm"
import { Effect, Layer, Schema } from "effect"
import { Location } from "../location"
import { PenHubArtifacts } from "../penhub/context/artifacts"
import { PenHubContextCompiler } from "../penhub/context/compile"
import { generateMarkdownReport } from "../penhub/report/markdown-report"
import { PenHubRunController } from "../penhub/run/controller"
import { PenHubRunStore } from "../penhub/run/store"
import { PenHubVerifier } from "../penhub/run/verifier"
import { FileAttackStateStore } from "../penhub/state-store"
import { PermissionV2 } from "../permission"
import { AppProcess } from "../process"
import { NonNegativeInt, PositiveInt } from "../schema"
import { Tool } from "./tool"
import { Tools } from "./tools"

const InitInput = Schema.Struct({
  name: Schema.String,
  type: Schema.Literals(["web", "crypto", "pwn", "rev", "misc", "cloud", "unknown"]),
  goal: Schema.String,
  maxAttempts: PositiveInt.pipe(Schema.optional),
  maxProviderTurns: PositiveInt.pipe(Schema.optional),
  maxTokens: PositiveInt.pipe(Schema.optional),
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

const BranchInput = Schema.Struct({
  claim: Schema.String,
  nextTest: Schema.String,
  expectedSignal: Schema.String,
})

const ReflectionInput = Schema.Struct({
  failedAssumption: Schema.String,
  validObservations: Schema.Array(Schema.String),
  avoid: Schema.String,
  nextTest: Schema.String,
})

const HypothesisInput = Schema.Struct({
  claim: Schema.String,
  nextTest: Schema.String,
  requiredEvidence: Schema.Array(Schema.String).pipe(Schema.optional),
  branchId: Schema.String.pipe(Schema.optional),
})

const ArtifactReadInput = Schema.Struct({
  path: Schema.String,
  mode: Schema.Literals(["head", "tail", "lines", "grep"]),
  offset: NonNegativeInt.pipe(Schema.optional),
  limit: PositiveInt.pipe(Schema.optional),
  pattern: Schema.String.pipe(Schema.optional),
})

const ArtifactReadOutput = Schema.Struct({
  path: Schema.String,
  mode: Schema.String,
  output: Schema.String,
  totalLines: NonNegativeInt,
  returnedLines: NonNegativeInt,
  truncated: Schema.Boolean,
})

const VerifyInput = Schema.Struct({
  candidate: Schema.String,
  claim: Schema.String,
  artifactPaths: Schema.Array(Schema.String),
})

const VerifyOutput = Schema.Struct({
  verified: Schema.Boolean,
  summary: Schema.String,
  artifactPath: Schema.String.pipe(Schema.optional),
})

export const names = [
  "penhub_init",
  "penhub_branch",
  "record_hypothesis",
  "penhub_record",
  "penhub_reflect",
  "penhub_artifact_read",
  "verify_candidate",
  "penhub_state",
  "penhub_report",
] as const

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const location = yield* Location.Service
    const permission = yield* PermissionV2.Service
    const appProcess = yield* AppProcess.Service
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
      Effect.mapError(
        (error: unknown) =>
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
              yield* Effect.promise(() =>
                PenHubRunStore.initialize(location.directory, {
                  goal: input.goal,
                  sessionId: context.sessionID,
                  maxAttempts: input.maxAttempts,
                  maxProviderTurns: input.maxProviderTurns,
                  maxTokens: input.maxTokens,
                }),
              )
              return { message: "PenHub challenge state initialized.", id }
            }).pipe(failure("penhub_init")),
        }),
        penhub_branch: Tool.make({
          description:
            "Add one bounded investigation branch with its smallest decisive test and expected observable signal. At most three branches may remain open.",
          input: BranchInput,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* authorize("penhub_branch", context)
              const branch = yield* Effect.promise(() => PenHubRunController.addBranch(location.directory, input))
              return { message: `Recorded ${branch.status} branch: ${branch.claim}`, id: branch.id }
            }).pipe(failure("penhub_branch")),
        }),
        record_hypothesis: Tool.make({
          description:
            "Record an interpretation to test. Hypotheses remain unverified until an executable oracle accepts a candidate.",
          input: HypothesisInput,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* authorize("record_hypothesis", context)
              const id = `hypothesis_${randomUUID()}`
              const now = new Date().toISOString()
              yield* Effect.promise(() =>
                new FileAttackStateStore(location.directory).appendHypothesis({
                  id,
                  claim: input.claim,
                  status: "open",
                  requiredEvidence: [...(input.requiredEvidence ?? [])],
                  nextTest: input.nextTest,
                  branchId: input.branchId,
                  confidence: 0.5,
                  createdAt: now,
                  updatedAt: now,
                }),
              )
              return { message: `Recorded testable hypothesis: ${input.claim}`, id }
            }).pipe(failure("record_hypothesis")),
        }),
        penhub_record: Tool.make({
          description:
            "Record a compact hypothesis, evidence reference, or failed attempt. Model prose cannot create verified facts; use verify_candidate for findings and penhub_branch for branches.",
          input: RecordInput,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* authorize("penhub_record", context)
              const store = new FileAttackStateStore(location.directory)
              const id = `${input.kind}_${randomUUID()}`
              const now = new Date().toISOString()
              if (input.kind === "fact")
                throw new Error("Model-authored facts are disabled; record a hypothesis or use verify_candidate")
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
                throw new Error("Use penhub_branch so every branch has a decisive test and expected signal")
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
        penhub_reflect: Tool.make({
          description:
            "Record the single bounded reflection allowed for the active branch after repeated or non-progressing attempts.",
          input: ReflectionInput,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* authorize("penhub_reflect", context)
              const lesson = yield* Effect.promise(() => PenHubRunController.reflect(location.directory, input))
              return {
                message: `Reflection recorded. Next substantially different test: ${lesson.nextTest}`,
                id: lesson.id,
              }
            }).pipe(failure("penhub_reflect")),
        }),
        penhub_artifact_read: Tool.make({
          description:
            "Read a bounded window from a retained .penhub/artifacts file using head, tail, line-range, or grep mode.",
          input: ArtifactReadInput,
          output: ArtifactReadOutput,
          toModelOutput: ({ output }) => [
            { type: "text", text: output.output },
            {
              type: "text",
              text: `${output.path}: ${output.returnedLines}/${output.totalLines} lines${output.truncated ? " (bounded)" : ""}`,
            },
          ],
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* authorize("penhub_artifact_read", context)
              return yield* Effect.promise(() => PenHubArtifacts.read(location.directory, input))
            }).pipe(failure("penhub_artifact_read")),
        }),
        verify_candidate: Tool.make({
          description:
            "Verify a candidate with the run's executable oracle. Only an accepted oracle result can mark a PenHub run solved.",
          input: VerifyInput,
          output: VerifyOutput,
          toModelOutput: ({ output }) => [
            {
              type: "text",
              text: `${output.verified ? "VERIFIED" : "NOT VERIFIED"}: ${output.summary}${output.artifactPath ? ` Evidence: ${output.artifactPath}` : ""}`,
            },
          ],
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* authorize("verify_candidate", context)
              return yield* PenHubVerifier.verify(appProcess, location.directory, input, configuredOracle())
            }).pipe(failure("verify_candidate")),
        }),
        penhub_state: Tool.make({
          description: "Read the current branch-specific PenHub task card.",
          input: EmptyInput,
          output: Output,
          toModelOutput: ({ output }) => [{ type: "text", text: output.message }],
          execute: (_input, context) =>
            Effect.gen(function* () {
              yield* authorize("penhub_state", context)
              return { message: yield* Effect.promise(() => PenHubContextCompiler.compileTaskCard(location.directory)) }
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

function configuredOracle() {
  const expectedSha256 = process.env.PENHUB_ORACLE_SHA256
  if (expectedSha256) {
    if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) throw new Error("PENHUB_ORACLE_SHA256 must be a SHA-256 digest")
    return { kind: "exact" as const, expectedSha256: expectedSha256.toLowerCase() }
  }
  const command = process.env.PENHUB_ORACLE_COMMAND
  return command ? { kind: "command" as const, command: [command] } : undefined
}
