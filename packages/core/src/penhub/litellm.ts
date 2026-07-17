export * as PenHubLiteLLM from "./litellm"

import os from "node:os"
import path from "node:path"

const baseURL = "http://127.0.0.1:4000/v1"
let child: Bun.ReadableSubprocess | undefined
let currentConfig: string | undefined
let lastError: string | undefined

export type Status = {
  state: "stopped" | "starting" | "ready" | "error"
  baseURL: string
  configPath?: string
  executable?: string
  pid?: number
  message?: string
}

export async function status(): Promise<Status> {
  const executable = Bun.which("litellm") ?? undefined
  if (await probe()) {
    return {
      state: "ready",
      baseURL,
      configPath: currentConfig,
      executable,
      pid: child?.pid,
    }
  }
  if (child?.exitCode === null) {
    return {
      state: "starting",
      baseURL,
      configPath: currentConfig,
      executable,
      pid: child.pid,
    }
  }
  if (lastError) {
    return {
      state: "error",
      baseURL,
      configPath: currentConfig,
      executable,
      message: lastError,
    }
  }
  return { state: "stopped", baseURL, executable }
}

export async function start(configPath: string): Promise<Status> {
  const resolved = resolveConfigPath(configPath)
  if (!(await Bun.file(resolved).exists())) throw new Error(`LiteLLM config does not exist: ${resolved}`)
  const executable = Bun.which("litellm") ?? undefined
  if (!executable) throw new Error("LiteLLM is not installed or is not available on PATH.")
  if (await probe()) {
    currentConfig = resolved
    lastError = undefined
    return status()
  }
  if (child?.exitCode === null) return waitUntilReady(child, executable, resolved)

  currentConfig = resolved
  lastError = undefined
  const spawned = Bun.spawn([executable, "--config", resolved, "--host", "127.0.0.1", "--port", "4000"], {
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  })
  child = spawned
  return waitUntilReady(spawned, executable, resolved)
}

export async function stop(): Promise<Status> {
  if (!child || child.exitCode !== null) return status()
  child.kill("SIGTERM")
  await Promise.race([child.exited, Bun.sleep(2_000)])
  if (child.exitCode === null) child.kill("SIGKILL")
  child = undefined
  currentConfig = undefined
  lastError = undefined
  return status()
}

export function resolveConfigPath(input: string) {
  const value = input.trim()
  if (!value) throw new Error("LiteLLM config path is required.")
  const resolved = path.resolve(
    value === "~" ? os.homedir() : value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value,
  )
  if (![".yaml", ".yml"].includes(path.extname(resolved).toLowerCase())) {
    throw new Error("LiteLLM config must be a .yaml or .yml file.")
  }
  return resolved
}

async function waitUntilReady(spawned: Bun.ReadableSubprocess, executable: string, configPath: string) {
  const output = Promise.all([new Response(spawned.stdout).text(), new Response(spawned.stderr).text()]).then((parts) =>
    parts.filter(Boolean).join("\n").trim(),
  )
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (await probe()) {
      void output.then((value) => {
        if (child !== spawned || spawned.exitCode === null) return
        lastError = processError(spawned.exitCode, value)
      })
      return {
        state: "ready",
        baseURL,
        configPath,
        executable,
        pid: spawned.pid,
      } satisfies Status
    }
    if (spawned.exitCode !== null) {
      lastError = processError(spawned.exitCode, await output)
      throw new Error(lastError)
    }
    await Bun.sleep(250)
  }
  spawned.kill("SIGTERM")
  lastError = `LiteLLM did not become ready at ${baseURL} within 15 seconds.`
  throw new Error(lastError)
}

function probe() {
  return fetch(`${baseURL}/models`, { signal: AbortSignal.timeout(700) })
    .then((response) => response.status < 500)
    .catch(() => false)
}

function processError(exitCode: number, output: string) {
  const detail = output.split("\n").filter(Boolean).slice(-8).join("\n")
  return `LiteLLM exited with code ${exitCode}.${detail ? `\n${detail}` : ""}`
}
