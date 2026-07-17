import path from "node:path"
import os from "node:os"
import { createServer } from "node:net"
import { Effect } from "effect"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"

export default Runtime.handler(
  Commands.commands.gui,
  Effect.fn("cli.gui")(function* (input) {
    return yield* Effect.scoped(
      Effect.gen(function* () {
        const apiPort = yield* Effect.promise(() => availablePort(input.hostname, input.apiPort))
        const guiPort = yield* Effect.promise(() =>
          availablePort(input.hostname, input.guiPort === apiPort ? input.guiPort + 1 : input.guiPort),
        )
        const apiUrl = `http://${input.hostname}:${apiPort}`
        const guiUrl = `http://${input.hostname}:${guiPort}/penhub.html`
        const liteLLMConfig = process.env.PENHUB_LITELLM_CONFIG ?? path.join(os.homedir(), "ctf/litellm_config.yaml")
        const processes = yield* Effect.acquireRelease(
          Effect.sync(() => ({
            api: Bun.spawn(
              [
                process.execPath,
                path.resolve(import.meta.dir, "../../index.ts"),
                "serve",
                "--hostname",
                input.hostname,
                "--port",
                String(apiPort),
              ],
              {
                env: {
                  ...process.env,
                  OPENCODE_DISABLE_SNAPSHOTS: process.env.OPENCODE_DISABLE_SNAPSHOTS ?? "1",
                  OPENCODE_SERVER_PASSWORD: "",
                },
                stdin: "inherit",
                stdout: "inherit",
                stderr: "inherit",
              },
            ),
            gui: Bun.spawn(
              [
                process.execPath,
                "run",
                "dev",
                "--",
                "--host",
                input.hostname,
                "--port",
                String(guiPort),
                "--strictPort",
              ],
              {
                cwd: path.resolve(import.meta.dir, "../../../../app"),
                env: { ...process.env, PENHUB_GUI: "1", VITE_PENHUB_SERVER_URL: apiUrl },
                stdin: "inherit",
                stdout: "inherit",
                stderr: "inherit",
              },
            ),
          })),
          (processes) =>
            Effect.promise(async () => {
              await fetch(`${apiUrl}/api/penhub/litellm/stop`, {
                method: "POST",
                signal: AbortSignal.timeout(1_000),
              }).catch(() => undefined)
              processes.api.kill()
              processes.gui.kill()
              await Promise.allSettled([processes.api.exited, processes.gui.exited])
            }),
        )

        if (apiPort !== input.apiPort) console.log(`API port ${input.apiPort} is in use; using ${apiPort}.`)
        if (guiPort !== input.guiPort) console.log(`GUI port ${input.guiPort} is in use; using ${guiPort}.`)
        console.log(`PenHub GUI: ${guiUrl}`)
        console.log("Press Ctrl+C to stop both the API and GUI.")
        yield* Effect.promise(() => startLiteLLM(apiUrl, liteLLMConfig))

        const exited = yield* Effect.promise(() =>
          Promise.race([
            processes.api.exited.then((code) => ({ name: "API", code })),
            processes.gui.exited.then((code) => ({ name: "GUI", code })),
          ]),
        )
        return yield* Effect.fail(new Error(`${exited.name} process exited with code ${exited.code}`))
      }),
    )
  }),
)

function availablePort(hostname: string, port: number): Promise<number> {
  if (port > 65_535) return Promise.reject(new Error(`No available port at or above ${port}`))
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        availablePort(hostname, port + 1).then(resolve, reject)
        return
      }
      reject(error)
    })
    server.listen({ host: hostname, port }, () => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve(port)
      })
    })
  })
}

async function startLiteLLM(apiUrl: string, configPath: string) {
  if (!(await Bun.file(configPath).exists())) return
  if (!(await waitForApi(apiUrl, 100))) {
    console.warn(`PenHub API did not become ready; LiteLLM was not started.`)
    return
  }
  const response = await fetch(`${apiUrl}/api/penhub/litellm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ configPath }),
  }).catch(() => undefined)
  if (!response) {
    console.warn("Could not start LiteLLM.")
    return
  }
  if (!response.ok) {
    console.warn(`Could not start LiteLLM: ${await response.text()}`)
    return
  }
  console.log(`LiteLLM ready: ${(await response.json()).baseURL}`)
}

async function waitForApi(apiUrl: string, attempts: number): Promise<boolean> {
  const response = await fetch(`${apiUrl}/api/penhub/litellm`).catch(() => undefined)
  if (response?.ok) return true
  if (attempts <= 1) return false
  await Bun.sleep(100)
  return waitForApi(apiUrl, attempts - 1)
}
