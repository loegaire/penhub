import { describe, expect, test } from "bun:test"
import { parseBenchmarkCaseManifest, resolveCasePaths } from "./manifest"

describe("PenHub benchmark case manifest", () => {
  test("parses a controlled case and resolves contained paths", () => {
    const manifest = parseBenchmarkCaseManifest({
      id: "receipt-puzzle-001",
      category: "code-puzzle",
      promptFile: "TASK.md",
      workspace: "workspace",
      oracle: ["bun", "oracle/verify.ts"],
      resultPattern: "FLAG\\{[^}]+\\}",
      wallTimeSeconds: 240,
      outputTokenLimit: 8_000,
      maxAttempts: 3,
      milestones: [
        { id: "workspace-inspected", kind: "tool-call", tool: "read" },
        { id: "receipt-generated", kind: "candidate" },
        { id: "receipt-verified", kind: "oracle" },
      ],
    })

    expect(manifest.oracle).toEqual(["bun", "oracle/verify.ts"])
    expect(resolveCasePaths("/tmp/case/case.json", manifest)).toEqual({
      root: "/tmp/case",
      workspace: "/tmp/case/workspace",
      prompt: "/tmp/case/workspace/TASK.md",
    })
  })

  test("rejects paths that escape the controlled case", () => {
    const manifest = parseBenchmarkCaseManifest({
      id: "receipt-puzzle-001",
      category: "code-puzzle",
      promptFile: "TASK.md",
      workspace: "../outside",
      oracle: ["bun", "oracle/verify.ts"],
      resultPattern: "FLAG\\{[^}]+\\}",
      wallTimeSeconds: 240,
      maxAttempts: 3,
      milestones: [],
    })

    expect(() => resolveCasePaths("/tmp/case/case.json", manifest)).toThrow("inside the case root")
  })

  test("rejects invalid result patterns", () => {
    expect(() =>
      parseBenchmarkCaseManifest({
        id: "bad-pattern",
        category: "code-puzzle",
        promptFile: "TASK.md",
        workspace: "workspace",
        oracle: ["bun", "oracle/verify.ts"],
        resultPattern: "[",
        wallTimeSeconds: 240,
        maxAttempts: 3,
        milestones: [],
      }),
    ).toThrow()
  })
})
