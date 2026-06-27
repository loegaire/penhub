import { readFile } from "node:fs/promises"
import { statePaths } from "./state-paths"
import { writeTokenUsage } from "./state-store"
import { emptyTokenUsage, type TokenUsage } from "./types"

export class TokenBudgetManager {
  constructor(readonly workspacePath: string) {}

  async recordUsage(input: {
    branchId?: string
    actionId?: string
    hypothesisId?: string
    inputTokens: number
    outputTokens: number
  }) {
    if (input.inputTokens < 0 || input.outputTokens < 0) throw new Error("PenHub token usage cannot be negative")
    const usage = await this.summarize()
    const total = input.inputTokens + input.outputTokens
    usage.totalInputTokens += input.inputTokens
    usage.totalOutputTokens += input.outputTokens
    usage.totalTokens += total
    if (input.branchId) increment(usage.byBranch, input.branchId, total)
    if (input.actionId) increment(usage.byAction, input.actionId, total)
    if (input.hypothesisId) increment(usage.byHypothesis, input.hypothesisId, total)
    await writeTokenUsage(this.workspacePath, usage)
  }

  async summarize(): Promise<TokenUsage> {
    try {
      return { ...emptyTokenUsage(), ...(JSON.parse(await readFile(statePaths(this.workspacePath).tokenUsage, "utf8")) as Partial<TokenUsage>) }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyTokenUsage()
      throw error
    }
  }
}

function increment(bucket: Record<string, number>, key: string, amount: number) {
  bucket[key] = (bucket[key] ?? 0) + amount
}
