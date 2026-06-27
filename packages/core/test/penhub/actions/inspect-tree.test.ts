import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { inspectTreeAction } from "@opencode-ai/core/penhub/index"
import { tempWorkspace } from "../helper"

describe("PenHub inspect_tree action", () => {
  test("returns a compact workspace tree and ignores noisy directories", async () => {
    const workspace = await tempWorkspace()
    await mkdir(path.join(workspace, "src"), { recursive: true })
    await mkdir(path.join(workspace, "node_modules", "pkg"), { recursive: true })
    await writeFile(path.join(workspace, "src", "app.ts"), "export const ok = true\n")
    await writeFile(path.join(workspace, "node_modules", "pkg", "index.js"), "ignored\n")

    const output = await inspectTreeAction.run(inspectTreeAction.inputSchema.parse({ maxEntries: 20 }), {
      workspacePath: workspace,
    })

    expect(output.compressedSummary).toContain("src")
    expect(output.files.map((item) => item.path)).toContain("src/app.ts")
    expect(output.files.map((item) => item.path)).not.toContain("node_modules/pkg/index.js")
    expect(output.truncated).toBe(false)
  })
})
