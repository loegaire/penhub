import type { PenHubActionRegistry } from "./registry"
import type { PenHubActionContext } from "./types"

export async function runPenHubAction(
  registry: PenHubActionRegistry,
  name: string,
  input: unknown,
  context: PenHubActionContext,
) {
  const action = registry.get(name)
  const parsedInput = action.inputSchema.parse(input)
  const output = await action.run(parsedInput, context)
  return action.outputSchema.parse(output)
}
