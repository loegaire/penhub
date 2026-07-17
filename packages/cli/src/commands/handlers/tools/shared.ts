import { Daemon } from "../../../services/daemon"
import { Effect } from "effect"

export const packs = ["web", "browser", "audit", "binary", "forensics", "crypto"] as const

export const request = Effect.fn("cli.tools.request")(function* (method: "GET" | "POST", path: string) {
  const daemon = yield* Daemon.Service
  const transport = yield* daemon.transport()
  const response = yield* Effect.tryPromise(() =>
    fetch(new URL(path, transport.url), { method, headers: transport.headers }),
  )
  const output = yield* Effect.promise(() => response.text())
  if (!response.ok) return yield* Effect.fail(new Error(output || `HTTP ${response.status}`))
  return output ? (JSON.parse(output) as unknown) : undefined
})

export function print(value: unknown) {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n")
}

export function requirePack(value: string) {
  const pack = packs.find((item) => item === value)
  if (!pack) throw new Error(`Unknown pack '${value}'. Expected: ${packs.join(", ")}`)
  return pack
}
