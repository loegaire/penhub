/// <reference path="../env.d.ts" />
import { tool } from "@opencode-ai/plugin"
import { runDefaultPenHubAction } from "../../packages/core/src/penhub/index"

export default tool({
  description: `Map likely API and form inputs through the PenHub action runtime.

This is a safe static precursor to API fuzzing: it extracts request body/query/param/env and HTML input surfaces from local source files.`,
  args: {
    rootPath: tool.schema.string().describe("Workspace-relative path to scan").default("."),
    pathsCsv: tool.schema.string().describe("Optional comma-separated workspace-relative file paths").optional(),
    maxFiles: tool.schema.number().describe("Maximum files to scan").default(200),
    workspacePath: tool.schema.string().describe("Workspace path containing .penhub/state").optional(),
  },
  async execute(args) {
    const output = await runDefaultPenHubAction(
      "extract_inputs",
      {
        rootPath: args.rootPath,
        paths: parseCsv(args.pathsCsv),
        maxFiles: args.maxFiles,
      },
      { workspacePath: args.workspacePath ?? process.cwd() },
    )
    return JSON.stringify(output, null, 2)
  },
})

function parseCsv(value: string | undefined) {
  return value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}
