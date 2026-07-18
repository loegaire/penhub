export * as PenHubSystemContext from "./system-context"

import { Effect, Layer, Schema } from "effect"
import { makeLocationNode } from "../effect/node"
import { Location } from "../location"
import { SystemContext } from "../system-context"
import { SystemContextRegistry } from "../system-context/registry"
import { buildStateCard } from "./context"
import { PenHubContextCompiler } from "./context/compile"
import { statePaths } from "./state-paths"

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const location = yield* Location.Service
    const registry = yield* SystemContextRegistry.Service
    const context = SystemContext.make({
      key: SystemContext.Key.make("penhub/attack-state"),
      codec: Schema.toCodecJson(Schema.String),
      load: Effect.promise(async () => {
        const paths = statePaths(location.directory)
        if (await Bun.file(paths.run).exists()) return PenHubContextCompiler.compileTaskCard(location.directory)
        if (await Bun.file(paths.challenge).exists())
          return buildStateCard({ workspacePath: location.directory, tokenBudget: 2_000 })
        return "# PenHub State Card\n\nNo challenge state has been initialized. Establish the goal, inspect the supplied artifacts or target, then record evidence as work progresses."
      }),
      baseline: (value) => value,
      update: (_previous, value) => value,
    })
    yield* registry.register({ key: SystemContext.Key.make("penhub/state-card"), load: Effect.succeed(context) })
  }),
)

export const node = makeLocationNode({
  name: "penhub-system-context",
  layer,
  deps: [Location.node, SystemContextRegistry.node],
})
