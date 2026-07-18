import { describe, expect, test } from "bun:test"
import path from "node:path"
import { mkdir } from "node:fs/promises"
import { PenHubArtifacts, statePaths } from "@opencode-ai/core/penhub/index"
import { tempWorkspace } from "./helper"

describe("PenHub artifact inspection", () => {
  test("reads bounded tails and grep matches without escaping artifacts", async () => {
    const workspace = await tempWorkspace()
    const artifact = path.join(statePaths(workspace).artifacts, "debugger.log")
    await mkdir(path.dirname(artifact), { recursive: true })
    await Bun.write(artifact, "start\nnoise\nCRASH at 0x4141\nfinal line\n")

    expect(
      (
        await PenHubArtifacts.read(workspace, {
          path: ".penhub/artifacts/debugger.log",
          mode: "tail",
          limit: 2,
        })
      ).output,
    ).toContain("final line")
    expect(
      (
        await PenHubArtifacts.read(workspace, {
          path: ".penhub/artifacts/debugger.log",
          mode: "grep",
          pattern: "CRASH",
        })
      ).output,
    ).toBe("3:CRASH at 0x4141")
    await expect(PenHubArtifacts.read(workspace, { path: "TASK.md", mode: "head" })).rejects.toThrow()
  })
})
