import { describe, expect, test } from "bun:test"
import { PenHubToolpack } from "@opencode-ai/core/penhub/toolpack"
import { PenHubStateTools } from "@opencode-ai/core/tool/penhub-state"

describe("PenHub OCI tool packs", () => {
  test("ships six packs with more than fifty unique tools", () => {
    const tools = PenHubToolpack.catalog.flatMap((pack) => pack.tools)
    expect(PenHubToolpack.catalog.map((pack) => pack.id)).toEqual([
      "web",
      "browser",
      "audit",
      "binary",
      "forensics",
      "crypto",
    ])
    expect(tools.length).toBeGreaterThanOrEqual(50)
    expect(new Set(tools.map((tool) => tool.name)).size).toBe(tools.length)
  })

  test("runs the packaged command through the OCI runtime", () => {
    const command = PenHubToolpack.buildRunCommand({
      runtime: "docker",
      image: "ghcr.io/penhub-ai/toolpack-web:0.1.0",
      workspace: "/tmp/challenge",
      command: "httpx",
      args: ["-u", "https://example.test", "-json"],
    })

    expect(command.command).toBe("docker")
    expect(command.args.slice(0, 3)).toEqual(["run", "--rm", "--init"])
    expect(command.args).toContain("ghcr.io/penhub-ai/toolpack-web:0.1.0")
    expect(command.args).toContain("/tmp/challenge:/workspace")
    expect(command.args.slice(-4)).toEqual(["httpx", "-u", "https://example.test", "-json"])
  })

  test("replaces repository wrappers with canonical state tools", () => {
    expect(PenHubStateTools.names).toEqual(["penhub_init", "penhub_record", "penhub_state", "penhub_report"])
  })
})
