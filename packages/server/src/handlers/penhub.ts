import { Location } from "@opencode-ai/core/location"
import { PenHubToolpack } from "@opencode-ai/core/penhub/toolpack"
import { PenHubLiteLLM } from "@opencode-ai/core/penhub/litellm"
import { AppProcess } from "@opencode-ai/core/process"
import { FileAttackStateStore } from "@opencode-ai/core/penhub/state-store"
import { generateMarkdownReport } from "@opencode-ai/core/penhub/report/markdown-report"
import { statePaths } from "@opencode-ai/core/penhub/state-paths"
import { readFile } from "node:fs/promises"
import { ServiceUnavailableError } from "@opencode-ai/protocol/errors"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
import { response } from "../location"

export const PenHubHandler = HttpApiBuilder.group(Api, "server.penhub", (handlers) =>
  handlers
    .handle("penhub.tools.list", () =>
      Effect.gen(function* () {
        const appProcess = yield* AppProcess.Service
        return yield* response(PenHubToolpack.list(appProcess))
      }),
    )
    .handle("penhub.tools.pull", (ctx) =>
      Effect.gen(function* () {
        yield* Location.Service
        const appProcess = yield* AppProcess.Service
        return yield* response(PenHubToolpack.pull(appProcess, ctx.params.pack)).pipe(
          Effect.mapError(
            (error) =>
              new ServiceUnavailableError({
                service: "penhub-toolpack",
                message: error instanceof Error ? error.message : String(error),
              }),
          ),
        )
      }),
    )
    .handle("penhub.state.get", () =>
      Effect.gen(function* () {
        const location = yield* Location.Service
        const snapshot = yield* Effect.promise(async () => {
          try {
            const workspace = await new FileAttackStateStore(location.directory).readWorkspaceState()
            const reportMarkdown = await readFile(statePaths(location.directory).report, "utf8").catch(() => undefined)
            return { initialized: true, workspace, reportMarkdown }
          } catch (error) {
            if (error instanceof Error && error.message.includes("challenge state is missing"))
              return { initialized: false }
            throw error
          }
        })
        return yield* response(Effect.succeed(snapshot))
      }),
    )
    .handle("penhub.report.generate", () =>
      Effect.gen(function* () {
        const location = yield* Location.Service
        return yield* response(
          Effect.tryPromise({
            try: () => generateMarkdownReport({ workspacePath: location.directory }),
            catch: (error) => (error instanceof Error ? error : new Error(String(error))),
          }).pipe(Effect.map((report) => ({ path: report.reportPath, markdown: report.markdown }))),
        ).pipe(
          Effect.mapError(
            (error) =>
              new ServiceUnavailableError({
                service: "penhub-report",
                message: error instanceof Error ? error.message : String(error),
              }),
          ),
        )
      }),
    )
    .handle("penhub.litellm.status", () => Effect.promise(() => PenHubLiteLLM.status()))
    .handle("penhub.litellm.start", (ctx) =>
      Effect.tryPromise({
        try: () => PenHubLiteLLM.start(ctx.payload.configPath),
        catch: (error) =>
          new ServiceUnavailableError({
            service: "litellm",
            message: error instanceof Error ? error.message : String(error),
          }),
      }),
    )
    .handle("penhub.litellm.stop", () =>
      Effect.tryPromise({
        try: () => PenHubLiteLLM.stop(),
        catch: (error) =>
          new ServiceUnavailableError({
            service: "litellm",
            message: error instanceof Error ? error.message : String(error),
          }),
      }),
    ),
)
