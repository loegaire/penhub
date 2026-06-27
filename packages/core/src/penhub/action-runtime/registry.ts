import type { PenHubActionManifest, PenHubActionSummary } from "./types"

export class PenHubActionRegistry {
  private readonly actions = new Map<string, PenHubActionManifest<unknown, unknown>>()

  constructor(actions: PenHubActionManifest<unknown, unknown>[] = []) {
    for (const action of actions) {
      this.register(action)
    }
  }

  register(action: PenHubActionManifest<unknown, unknown>) {
    if (this.actions.has(action.name)) {
      throw new Error(`Duplicate PenHub action: ${action.name}`)
    }
    this.actions.set(action.name, action)
    return this
  }

  get(name: string) {
    const action = this.actions.get(name)
    if (!action) throw new Error(`Unknown PenHub action: ${name}`)
    return action
  }

  list(): PenHubActionSummary[] {
    return [...this.actions.values()]
      .map((action) => ({
        name: action.name,
        description: action.description,
        riskLevel: action.riskLevel,
      }))
      .sort((left, right) => left.name.localeCompare(right.name))
  }
}

export function createActionRegistry(actions: PenHubActionManifest<unknown, unknown>[] = []) {
  return new PenHubActionRegistry(actions)
}
