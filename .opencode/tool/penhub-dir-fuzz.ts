/// <reference path="../env.d.ts" />
import { tool } from "@opencode-ai/plugin"
import { runDefaultPenHubAction } from "../../packages/core/src/penhub/index"

export default tool({
  description: `Run a small local directory probe through the PenHub action runtime.

Only local base URLs are allowed. Results are compact and raw output is artifact-backed when needed.`,
  args: {
    baseUrl: tool.schema.string().describe("Local base URL, for example http://localhost:3000/"),
    words: tool.schema.string().describe("Wordlist as newline-separated or comma-separated paths"),
    maxHits: tool.schema.number().describe("Maximum successful hits to return").default(50),
    workspacePath: tool.schema.string().describe("Workspace path containing .penhub/state").optional(),
  },
  async execute(args) {
    const output = await runDefaultPenHubAction(
      "dir_fuzz",
      {
        baseUrl: args.baseUrl,
        words: parseWords(args.words),
        maxHits: args.maxHits,
      },
      { workspacePath: args.workspacePath ?? process.cwd() },
    )
    return JSON.stringify(output, null, 2)
  },
})

function parseWords(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}
