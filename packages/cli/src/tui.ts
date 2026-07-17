import { run } from "@opencode-ai/tui"
import { TuiConfig } from "@opencode-ai/tui/config"
import { Global } from "@opencode-ai/core/global"
import { Effect } from "effect"
import { createTuiFetch } from "./tui-fetch"

export function runTui(transport: { url: string; headers: RequestInit["headers"] }) {
  const config = TuiConfig.resolve({}, { terminalSuspend: false })
  const slots = { dispose() {} }
  return run({
    ...transport,
    args: {},
    config,
    directory: process.cwd(),
    fetch: createTuiFetch(),
    pluginHost: {
      async start(input) {
        slots.dispose = input.runtime.setupSlots(input.api).dispose
      },
      async dispose() {
        slots.dispose()
      },
    },
  }).pipe(Effect.provide(Global.defaultLayer))
}
