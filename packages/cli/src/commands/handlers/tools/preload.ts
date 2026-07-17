import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { packs, print, request } from "./shared"

export default Runtime.handler(
  Commands.commands.tools.commands.preload,
  Effect.fn("cli.tools.preload")(function* () {
    const directory = encodeURIComponent(process.cwd())
    const results = yield* Effect.forEach(packs, (pack) =>
      request("POST", `/api/penhub/tools/${pack}/pull?location[directory]=${directory}`),
    )
    print(results)
  }),
)
