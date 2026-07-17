export * as SecurityTools from "./security"

import { ToolFailure } from "@opencode-ai/llm"
import { Effect, Layer } from "effect"
import { Location } from "../location"
import { PenHubToolpack } from "../penhub/toolpack"
import { PermissionV2 } from "../permission"
import { AppProcess } from "../process"
import { Tool } from "./tool"
import { Tools } from "./tools"

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const location = yield* Location.Service
    const appProcess = yield* AppProcess.Service
    const permission = yield* PermissionV2.Service
    const definitions = PenHubToolpack.catalog.flatMap((pack) => pack.tools)

    yield* tools
      .register(
        Object.fromEntries(
          definitions.map((definition) => [
            definition.name,
            Tool.make({
              description: `${definition.description} Runs ${definition.command} from the packaged ${definition.pack} OCI tool pack; pass arguments as an array without shell quoting.`,
              input: PenHubToolpack.RunInput,
              output: PenHubToolpack.RunOutput,
              toModelOutput: ({ output }) => [
                { type: "text", text: output.preview },
                {
                  type: "text",
                  text: `Exit: ${output.exit}. Raw output: ${output.artifactPath}. Runtime: ${output.runtime}.`,
                },
              ],
              execute: (input, context) =>
                Effect.gen(function* () {
                  yield* permission.assert({
                    action: definition.name,
                    resources: input.args.length ? input.args : ["*"],
                    save: ["*"],
                    metadata: { pack: definition.pack, command: definition.command },
                    sessionID: context.sessionID,
                    agent: context.agent,
                    source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
                  })
                  return yield* PenHubToolpack.run(appProcess, location.directory, definition, input)
                }).pipe(
                  Effect.mapError(
                    (error) =>
                      new ToolFailure({
                        message: error instanceof Error ? error.message : `Unable to run ${definition.name}`,
                      }),
                  ),
                ),
            }),
          ]),
        ),
      )
      .pipe(Effect.orDie)
  }),
)
