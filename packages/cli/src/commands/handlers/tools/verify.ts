import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { print, request } from "./shared"

type Response = { data?: { data?: Array<{ id: string; installed: boolean }> } }

export default Runtime.handler(
  Commands.commands.tools.commands.verify,
  Effect.fn("cli.tools.verify")(function* () {
    const result = (yield* request(
      "GET",
      `/api/penhub/tools?location[directory]=${encodeURIComponent(process.cwd())}`,
    )) as Response
    const packs = result.data?.data ?? []
    print(packs)
    const missing = packs.filter((pack) => !pack.installed)
    if (missing.length) return yield* Effect.fail(new Error(`Missing tool packs: ${missing.map((pack) => pack.id).join(", ")}`))
  }),
)
