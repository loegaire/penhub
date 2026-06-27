/// <reference path="../env.d.ts" />
import { tool } from "@opencode-ai/plugin"
import { runDefaultPenHubAction } from "../../packages/core/src/penhub/index"

const methods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"] as ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]

export default tool({
  description: `Send a compact local HTTP probe through the PenHub action runtime.

Only local HTTP targets are allowed. Long response bodies are stored under .penhub/artifacts and compact summaries are returned to context.`,
  args: {
    url: tool.schema.string().describe("Local HTTP URL to request, for example http://localhost:3000/admin"),
    method: tool.schema.enum(methods).describe("HTTP method").default("GET"),
    headersJson: tool.schema.string().describe("Optional JSON object of string headers").optional(),
    body: tool.schema.string().describe("Optional request body").optional(),
    workspacePath: tool.schema.string().describe("Workspace path containing .penhub/state").optional(),
  },
  async execute(args) {
    const output = await runDefaultPenHubAction(
      "send_request",
      {
        url: args.url,
        method: args.method,
        headers: parseStringRecord(args.headersJson),
        body: args.body,
      },
      { workspacePath: args.workspacePath ?? process.cwd() },
    )
    return JSON.stringify(output, null, 2)
  },
})

function parseStringRecord(value: string | undefined) {
  if (!value) return {}
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("headersJson must be a JSON object")
  const output: Record<string, string> = {}
  for (const [key, item] of Object.entries(parsed)) {
    if (typeof item !== "string") throw new Error(`headersJson.${key} must be a string`)
    output[key] = item
  }
  return output
}
