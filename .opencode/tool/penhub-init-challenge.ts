/// <reference path="../env.d.ts" />
import { randomUUID } from "node:crypto"
import { tool } from "@opencode-ai/plugin"
import { FileAttackStateStore, type Challenge, type ChallengeType } from "../../packages/core/src/penhub/index"

const challengeTypes = ["web", "crypto", "pwn", "rev", "misc", "cloud", "unknown"] as [
  ChallengeType,
  ...ChallengeType[],
]

export default tool({
  description: `Initialize PenHub attack-state files for a CTF or local pentest challenge.

This creates .penhub/state JSON and JSONL files plus artifact and tmp directories. It does not run network probes or exploit code.`,
  args: {
    name: tool.schema.string().describe("Challenge name"),
    goal: tool.schema.string().describe("Challenge goal"),
    type: tool.schema.enum(challengeTypes).describe("Challenge type").default("unknown"),
    workspacePath: tool.schema.string().describe("Workspace path to initialize").optional(),
  },
  async execute(args) {
    const workspacePath = args.workspacePath ?? process.cwd()
    const challenge: Challenge = {
      id: `challenge_${randomUUID()}`,
      name: args.name,
      type: args.type as ChallengeType,
      goal: args.goal,
      workspacePath,
      createdAt: new Date().toISOString(),
    }
    await new FileAttackStateStore(workspacePath).initChallenge(challenge)
    return `Initialized PenHub challenge ${challenge.id} at ${workspacePath}/.penhub`
  },
})
