import { createActionRegistry, runPenHubAction, type PenHubActionContext } from "../action-runtime"
import { builtInPenHubActions } from "./core-actions"

export * from "./core-actions"

export function createDefaultPenHubActionRegistry() {
  return createActionRegistry(builtInPenHubActions)
}

export async function runDefaultPenHubAction(name: string, input: unknown, context: PenHubActionContext) {
  return runPenHubAction(createDefaultPenHubActionRegistry(), name, input, context)
}
