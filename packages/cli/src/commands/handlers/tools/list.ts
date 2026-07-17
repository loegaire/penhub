import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { print, request } from "./shared"

export default Runtime.handler(
  Commands.commands.tools.commands.list,
  Effect.fn("cli.tools.list")(function* () {
    print(yield* request("GET", `/api/penhub/tools?location[directory]=${encodeURIComponent(process.cwd())}`))
  }),
)
