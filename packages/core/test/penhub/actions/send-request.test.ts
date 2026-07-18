import { describe, expect, test } from "bun:test"
import { sendRequestAction } from "@opencode-ai/core/penhub/actions/core-actions"
import { tempWorkspace } from "../helper"

describe("PenHub send_request action", () => {
  test("probes a local HTTP target and returns compact output", async () => {
    const workspace = await tempWorkspace()
    const server = Bun.serve({
      port: 0,
      fetch() {
        return new Response("demo body", { status: 200, headers: { "content-type": "text/plain" } })
      },
    })

    try {
      const output = await sendRequestAction.run(sendRequestAction.inputSchema.parse({ url: server.url.toString() }), {
        workspacePath: workspace,
      })

      expect(output.status).toBe(200)
      expect(output.contentType).toContain("text/plain")
      expect(output.bodyPreview).toBe("demo body")
      expect(output.compressedSummary).toContain("HTTP 200")
    } finally {
      await server.stop(true)
    }
  })

  test("rejects non-local network targets", async () => {
    const workspace = await tempWorkspace()

    await expectRejected(
      async () =>
        sendRequestAction.run(sendRequestAction.inputSchema.parse({ url: "https://example.com" }), {
          workspacePath: workspace,
        }),
      "only allows local targets",
    )
  })
})

async function expectRejected(run: () => Promise<unknown>, message: string) {
  try {
    await run()
  } catch (error) {
    expect(error instanceof Error ? error.message : String(error)).toContain(message)
    return
  }
  throw new Error(`Expected rejection containing: ${message}`)
}
