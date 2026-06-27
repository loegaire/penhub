import { describe, expect, test } from "bun:test"
import { checkOwnedPaths } from "./ownership"

describe("PenHub ownership guard", () => {
  test("allows codex 3 to change UI, benchmark, harness, scripts, docs, and github files", () => {
    expect(
      checkOwnedPaths({
        codexId: "3",
        changedFiles: [
          "packages/app/src/features/penhub/PenHubWorkspace.tsx",
          "benchmarks/penhub/metrics/schema.ts",
          "harness/penhub/smoke/smoke-run.ts",
          "scripts/penhub/check-ownership.ts",
          "docs/penhub/codex-3-handoff.md",
          ".github/workflows/penhub.yml",
          "packages/app/src/app.tsx",
        ],
      }),
    ).toEqual([])
  })

  test("blocks codex 3 from changing PenHub core runtime files", () => {
    expect(
      checkOwnedPaths({
        codexId: "3",
        changedFiles: ["packages/core/src/penhub/state-store.ts"],
      }),
    ).toEqual(["packages/core/src/penhub/state-store.ts"])
  })

  test("blocks unknown codex identifiers", () => {
    expect(() => checkOwnedPaths({ codexId: "4", changedFiles: [] })).toThrow("CODEX_ID")
  })
})
