/// <reference path="../env.d.ts" />
import { tool } from "@opencode-ai/plugin"
import { runDefaultPenHubAction } from "../../packages/core/src/penhub/index"

const evidenceTypes = ["file", "http", "log", "runtime", "diff", "flag", "manual"] as [
  "file",
  "http",
  "log",
  "runtime",
  "diff",
  "flag",
  "manual",
]

export default tool({
  description: `Capture a compact PenHub evidence capsule.

If rawContent is provided, it is written to .penhub/artifacts/evidence and hashed. The returned tool result stays compact.`,
  args: {
    type: tool.schema.enum(evidenceTypes).describe("Evidence type").default("manual"),
    summary: tool.schema.string().describe("Short evidence summary"),
    rawContent: tool.schema.string().describe("Optional raw evidence content to store as an artifact").optional(),
    artifactPath: tool.schema.string().describe("Optional existing artifact path").optional(),
    artifactName: tool.schema.string().describe("Optional artifact filename for rawContent").optional(),
    supportsCsv: tool.schema
      .string()
      .describe("Comma-separated fact, hypothesis, or branch IDs supported by this evidence")
      .optional(),
    branchId: tool.schema.string().describe("Optional branch ID").optional(),
    hypothesisId: tool.schema.string().describe("Optional hypothesis ID").optional(),
    workspacePath: tool.schema.string().describe("Workspace path containing .penhub/state").optional(),
  },
  async execute(args) {
    const output = await runDefaultPenHubAction(
      "record_evidence",
      {
        type: args.type,
        summary: args.summary,
        rawContent: args.rawContent,
        artifactPath: args.artifactPath,
        artifactName: args.artifactName,
        supports: parseCsv(args.supportsCsv),
        branchId: args.branchId,
        hypothesisId: args.hypothesisId,
      },
      { workspacePath: args.workspacePath ?? process.cwd() },
    )
    return JSON.stringify(output, null, 2)
  },
})

function parseCsv(value: string | undefined) {
  return (
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  )
}
