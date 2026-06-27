import { access } from "node:fs/promises"
import { describe, expect, test } from "bun:test"
import { compressObservation, parseFfufJson, parseHttpResponse, parseNucleiJsonl } from "@opencode-ai/core/penhub/index"
import { tempWorkspace } from "./helper"

describe("PenHub observation and parsers", () => {
  test("stores long raw output outside context", async () => {
    const workspace = await tempWorkspace()
    const result = await compressObservation({
      workspacePath: workspace,
      rawOutput: "GET /health\n" + "long output ".repeat(500),
      rawOutputId: "fixed",
      maxInlineChars: 100,
    })
    expect(result.includeInContext).toBe(false)
    expect(result.compressedSummary.length).toBeLessThanOrEqual(1_000)
    expect(result.rawOutputPath?.endsWith("raw_fixed.txt")).toBe(true)
    await access(result.rawOutputPath!)
  })

  test("parses structured tool outputs", () => {
    expect(parseHttpResponse("HTTP/1.1 200 OK\ncontent-type: text/plain\n\nhello").statusCode).toBe(200)
    expect(
      parseFfufJson(JSON.stringify({ results: [{ url: "http://local/admin", status: 200, length: 12 }] })),
    ).toEqual([{ url: "http://local/admin", status: 200, length: 12 }])
    expect(
      parseNucleiJsonl(
        '{"template-id":"sample","info":{"severity":"info","name":"Sample"},"matched-at":"http://local"}\n',
      ),
    ).toEqual([{ templateId: "sample", severity: "info", matchedAt: "http://local", name: "Sample" }])
  })
})
