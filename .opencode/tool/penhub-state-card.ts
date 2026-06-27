/// <reference path="../env.d.ts" />
import { tool } from "@opencode-ai/plugin"
import { buildStateCard } from "../../packages/core/src/penhub/index"

export default tool({
  description: `Build a compact PenHub State Card from .penhub/state.

Use this before selecting the next CTF or local pentest action. It summarizes challenge facts, hypotheses, evidence, failed branches, token usage, and next branch candidates without including raw long tool output.`,
  args: {
    workspacePath: tool.schema.string().describe("Workspace path containing .penhub/state").optional(),
    maxFacts: tool.schema.number().describe("Maximum facts to include").default(8),
    maxHypotheses: tool.schema.number().describe("Maximum hypotheses to include").default(6),
    maxBranches: tool.schema.number().describe("Maximum branches to include").default(6),
    tokenBudget: tool.schema.number().describe("Approximate context budget for the state card").optional(),
  },
  async execute(args) {
    return buildStateCard({
      workspacePath: args.workspacePath ?? process.cwd(),
      maxFacts: args.maxFacts,
      maxHypotheses: args.maxHypotheses,
      maxBranches: args.maxBranches,
      tokenBudget: args.tokenBudget,
    })
  },
})
