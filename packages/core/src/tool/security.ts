export * as SecurityTools from "./security"

import { ToolFailure } from "@opencode-ai/llm"
import { Effect, Layer } from "effect"
import { Location } from "../location"
import { InteractiveSession } from "../penhub/tool/interactive-session"
import { PenHubToolpack } from "../penhub/toolpack"
import { PermissionV2 } from "../permission"
import { AppProcess } from "../process"
import { Pty } from "../pty"
import { Tool } from "./tool"
import { Tools } from "./tools"

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const location = yield* Location.Service
    const appProcess = yield* AppProcess.Service
    const pty = yield* Pty.Service
    const permission = yield* PermissionV2.Service
    const definitions = PenHubToolpack.catalog.flatMap((pack) => pack.tools)
    const interactive = InteractiveSession.make({
      pty,
      workspace: location.directory,
      prepare: (input) => PenHubToolpack.prepareInteractive(appProcess, location.directory, input),
    })
    yield* Effect.addFinalizer(() => interactive.close())

    yield* tools
      .register({
        ...Object.fromEntries(
          definitions.map((definition) => [
            definition.name,
            Tool.make({
              description: `${definition.description} Runs ${definition.command} from the packaged ${definition.pack} OCI tool pack; pass arguments as an array without shell quoting.`,
              input: PenHubToolpack.RunInput,
              output: PenHubToolpack.RunOutput,
              toModelOutput: ({ output }) => [
                { type: "text", text: output.summary },
                {
                  type: "text",
                  text: `Exit: ${output.exitCode}. Raw output: ${output.artifactPath}. Runtime: ${output.toolSpecific.runtime}.`,
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
                  return yield* PenHubToolpack.run(
                    appProcess,
                    location.directory,
                    definition,
                    input,
                    `attempt_${context.toolCallID}`,
                  )
                }).pipe(Effect.mapError((error) => failure(error, `Unable to run ${definition.name}`))),
            }),
          ]),
        ),
        sec_session_start: Tool.make({
          description:
            "Start a persistent PTY-backed process inside a PenHub OCI tool pack. Use this for GDB, REPLs, netcat, servers, and other stateful interactive programs.",
          input: InteractiveSession.StartInput,
          output: InteractiveSession.StartOutput,
          toModelOutput: ({ output }) => [
            {
              type: "text",
              text: `Session ${output.sessionId} is ${output.sessionStatus}. Cursor: ${output.cursor}. Transcript: ${output.artifactPath}.`,
            },
          ],
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* assertPermission(
                permission,
                "sec_session_start",
                [input.pack, input.command, ...input.args],
                context,
              )
              return { ...(yield* interactive.start(input)), id: `attempt_${context.toolCallID}` }
            }).pipe(Effect.mapError((error) => failure(error, "Unable to start interactive session"))),
        }),
        sec_session_write: Tool.make({
          description:
            "Write exact input to a running PenHub interactive session. Include newlines or control characters explicitly.",
          input: InteractiveSession.WriteInput,
          output: InteractiveSession.WriteOutput,
          toModelOutput: ({ output }) => [
            {
              type: "text",
              text: `Wrote ${output.bytesWritten} bytes to ${output.sessionId}; session is ${output.sessionStatus}. Transcript: ${output.artifactPath}.`,
            },
          ],
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* assertPermission(permission, "sec_session_write", [input.sessionId], context)
              return { ...(yield* interactive.write(input)), id: `attempt_${context.toolCallID}` }
            }).pipe(Effect.mapError((error) => failure(error, "Unable to write interactive session"))),
        }),
        sec_session_read: Tool.make({
          description:
            "Read bounded output from a PenHub interactive session, including retained output after process exit. Pass the returned cursor to continue incrementally.",
          input: InteractiveSession.ReadInput,
          output: InteractiveSession.ReadOutput,
          toModelOutput: ({ output }) => [
            { type: "text", text: output.output },
            {
              type: "text",
              text: `Session ${output.sessionId}: ${output.sessionStatus}; cursor ${output.cursor}/${output.availableCursor}; transcript ${output.artifactPath}${output.truncated ? "; more retained output is available" : ""}.`,
            },
          ],
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* assertPermission(permission, "sec_session_read", [input.sessionId], context)
              return { ...(yield* interactive.read(input)), id: `attempt_${context.toolCallID}` }
            }).pipe(Effect.mapError((error) => failure(error, "Unable to read interactive session"))),
        }),
        sec_session_stop: Tool.make({
          description: "Stop and remove a PenHub interactive session while retaining its complete transcript artifact.",
          input: InteractiveSession.StopInput,
          output: InteractiveSession.StopOutput,
          toModelOutput: ({ output }) => [
            {
              type: "text",
              text: `Stopped ${output.sessionId}. Transcript retained at ${output.artifactPath}.`,
            },
          ],
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* assertPermission(permission, "sec_session_stop", [input.sessionId], context)
              return { ...(yield* interactive.stop(input)), id: `attempt_${context.toolCallID}` }
            }).pipe(Effect.mapError((error) => failure(error, "Unable to stop interactive session"))),
        }),
      })
      .pipe(Effect.orDie)
  }),
)

function assertPermission(
  permission: PermissionV2.Interface,
  action: string,
  resources: string[],
  context: Tool.Context,
) {
  return permission.assert({
    action,
    resources,
    save: ["*"],
    metadata: {},
    sessionID: context.sessionID,
    agent: context.agent,
    source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
  })
}

function failure(error: unknown, fallback: string) {
  return new ToolFailure({ message: error instanceof Error ? error.message : fallback })
}
