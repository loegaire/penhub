/// <reference path="../env.d.ts" />
import { tool } from "@opencode-ai/plugin"
import { runDefaultPenHubAction } from "../../packages/core/src/penhub/index"

export default tool({
  description: `Generate a Markdown PenHub report from structured state and evidence.

The report is generated from .penhub/state JSON/JSONL records, not from hidden chat transcript context.`,
  args: {
    outputPath: tool.schema.string().describe("Optional report output path").optional(),
    workspacePath: tool.schema.string().describe("Workspace path containing .penhub/state").optional(),
  },
  async execute(args) {
    const output = await runDefaultPenHubAction(
      "generate_report",
      {
        outputPath: args.outputPath,
      },
      { workspacePath: args.workspacePath ?? process.cwd() },
    )
    return JSON.stringify(output, null, 2)
  },
})
