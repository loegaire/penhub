import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { print, request, requirePack } from "./shared"

export default Runtime.handler(
  Commands.commands.tools.commands.pull,
  Effect.fn("cli.tools.pull")(function* (input) {
    const pack = yield* Effect.try({ try: () => requirePack(input.pack), catch: (error) => error })
    print(
      yield* request(
        "POST",
        `/api/penhub/tools/${pack}/pull?location[directory]=${encodeURIComponent(process.cwd())}`,
      ),
    )
  }),
)
