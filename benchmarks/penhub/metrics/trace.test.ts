import { describe, expect, test } from "bun:test"
import { parseCliEvents, summarizeCliEvents } from "./trace"

describe("PenHub benchmark traces", () => {
  test("extracts candidate timing, token usage, and stable repeated actions", () => {
    const summary = summarizeCliEvents(
      parseCliEvents(
        [
          JSON.stringify({
            type: "tool_use",
            timestamp: 100,
            sessionID: "ses_test",
            part: { tool: "read", state: { status: "completed", input: { path: "checker.ts", limit: 50 } } },
          }),
          JSON.stringify({
            type: "tool_use",
            timestamp: 200,
            sessionID: "ses_test",
            part: { tool: "read", state: { status: "completed", input: { limit: 50, path: "checker.ts" } } },
          }),
          JSON.stringify({
            type: "text",
            timestamp: 300,
            sessionID: "ses_test",
            part: { text: "Candidate: FLAG{verified}" },
          }),
          JSON.stringify({
            type: "step_finish",
            timestamp: 400,
            sessionID: "ses_test",
            part: { reason: "stop", tokens: { input: 100, output: 20, reasoning: 5, cache: { read: 10 } } },
          }),
        ].join("\n") + "\n",
      ),
      "FLAG\\{[^}]+\\}",
    )

    expect(summary.sessionID).toBe("ses_test")
    expect(summary.candidate).toBe("FLAG{verified}")
    expect(summary.candidateTimestamp).toBe(300)
    expect(summary.fingerprints[0]).toBe(summary.fingerprints[1])
    expect(summary.tokens).toEqual({ input: 110, output: 20, reasoning: 5 })
  })
})
