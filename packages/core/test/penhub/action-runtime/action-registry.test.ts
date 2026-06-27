import { describe, expect, test } from "bun:test"
import {
  createActionRegistry,
  createDefaultPenHubActionRegistry,
  runPenHubAction,
} from "@opencode-ai/core/penhub/index"
import { tempWorkspace } from "../helper"

describe("PenHub action registry", () => {
  test("lists built-in Codex2 actions", () => {
    const names = createDefaultPenHubActionRegistry()
      .list()
      .map((action) => action.name)

    expect(names).toContain("inspect_tree")
    expect(names).toContain("send_request")
    expect(names).toContain("record_evidence")
    expect(names).toContain("generate_report")
  })

  test("rejects duplicate action names", () => {
    const registry = createDefaultPenHubActionRegistry()
    const action = registry.get("inspect_tree")

    expect(() => createActionRegistry([action, action])).toThrow("Duplicate PenHub action")
  })

  test("runs an action through validated input and output schemas", async () => {
    const workspace = await tempWorkspace()
    const output = await runPenHubAction(
      createDefaultPenHubActionRegistry(),
      "inspect_tree",
      { maxEntries: 5 },
      { workspacePath: workspace },
    )

    expect(output).toMatchObject({
      truncated: false,
    })
  })
})
