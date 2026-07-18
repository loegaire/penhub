export * as PenHubSemanticTools from "./penhub-semantic"

import { ToolFailure } from "@opencode-ai/llm"
import { Effect, Layer, Schema } from "effect"
import { Location } from "../location"
import { compareResponsesAction, inspectTreeAction, summarizeFilesAction } from "../penhub/actions/core-actions"
import { PermissionV2 } from "../permission"
import { PositiveInt } from "../schema"
import { Tool } from "./tool"
import { Tools } from "./tools"

const Compact = {
  summary: Schema.String,
  artifactPath: Schema.String.pipe(Schema.optional),
}

const InspectTreeInput = Schema.Struct({
  rootPath: Schema.String.pipe(Schema.optional),
  maxEntries: PositiveInt.pipe(Schema.optional),
  includeHidden: Schema.Boolean.pipe(Schema.optional),
})
const InspectTreeOutput = Schema.Struct({
  ...Compact,
  files: Schema.Array(
    Schema.Struct({
      path: Schema.String,
      type: Schema.Literals(["file", "dir"]),
      size: Schema.Number.pipe(Schema.optional),
    }),
  ),
  truncated: Schema.Boolean,
})

const SummarizeFilesInput = Schema.Struct({
  paths: Schema.Array(Schema.String),
  maxBytesPerFile: PositiveInt.pipe(Schema.optional),
})
const SummarizeFilesOutput = Schema.Struct({
  ...Compact,
  files: Schema.Array(
    Schema.Struct({
      path: Schema.String,
      bytes: Schema.Number,
      lines: Schema.Number,
      preview: Schema.String,
      truncated: Schema.Boolean,
    }),
  ),
})

const Response = Schema.Struct({
  label: Schema.String.pipe(Schema.optional),
  status: Schema.Number.pipe(Schema.optional),
  body: Schema.String,
})
const CompareResponsesInput = Schema.Struct({ left: Response, right: Response })
const CompareResponsesOutput = Schema.Struct({
  ...Compact,
  sameStatus: Schema.Boolean,
  lengthDelta: Schema.Number,
  commonPrefixChars: Schema.Number,
})

export const names = ["inspect_tree", "summarize_files", "compare_responses"] as const

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const location = yield* Location.Service
    const permission = yield* PermissionV2.Service
    const authorize = (name: (typeof names)[number], resources: string[], context: Tool.Context) =>
      permission.assert({
        action: name,
        resources,
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
        inspect_tree: Tool.make({
          description: "List a compact workspace tree without reading file contents or noisy dependency trees.",
          input: InspectTreeInput,
          output: InspectTreeOutput,
          toModelOutput: ({ output }) => [{ type: "text", text: output.summary }],
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* authorize("inspect_tree", [input.rootPath ?? "."], context)
              const output = yield* Effect.promise(
                async () =>
                  await inspectTreeAction.run(inspectTreeAction.inputSchema.parse(input), {
                    workspacePath: location.directory,
                  }),
              )
              return {
                summary: output.compressedSummary,
                artifactPath: output.artifactPath,
                files: output.files,
                truncated: output.truncated,
              }
            }).pipe(failure("inspect_tree")),
        }),
        summarize_files: Tool.make({
          description: "Read selected workspace files through bounded previews with line and byte counts.",
          input: SummarizeFilesInput,
          output: SummarizeFilesOutput,
          toModelOutput: ({ output }) => [{ type: "text", text: output.summary }],
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* authorize("summarize_files", [...input.paths], context)
              const output = yield* Effect.promise(
                async () =>
                  await summarizeFilesAction.run(summarizeFilesAction.inputSchema.parse(input), {
                    workspacePath: location.directory,
                  }),
              )
              return {
                summary: output.compressedSummary,
                artifactPath: output.artifactPath,
                files: output.files,
              }
            }).pipe(failure("summarize_files")),
        }),
        compare_responses: Tool.make({
          description: "Compare two bounded HTTP or protocol responses without reissuing either request.",
          input: CompareResponsesInput,
          output: CompareResponsesOutput,
          toModelOutput: ({ output }) => [{ type: "text", text: output.summary }],
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* authorize("compare_responses", [input.left.label ?? "left", input.right.label ?? "right"], context)
              const output = yield* Effect.promise(
                async () =>
                  await compareResponsesAction.run(compareResponsesAction.inputSchema.parse(input), {
                    workspacePath: location.directory,
                  }),
              )
              return {
                summary: output.compressedSummary,
                artifactPath: output.artifactPath,
                sameStatus: output.sameStatus,
                lengthDelta: output.lengthDelta,
                commonPrefixChars: output.commonPrefixChars,
              }
            }).pipe(failure("compare_responses")),
        }),
      })
      .pipe(Effect.orDie)
  }),
)
