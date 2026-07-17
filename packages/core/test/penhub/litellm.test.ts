import { describe, expect, test } from "bun:test"
import os from "node:os"
import path from "node:path"
import { PenHubLiteLLM } from "@opencode-ai/core/penhub/litellm"

describe("PenHub LiteLLM", () => {
  test("expands a home-relative YAML path", () => {
    expect(PenHubLiteLLM.resolveConfigPath("~/ctf/litellm_config.yaml")).toBe(
      path.join(os.homedir(), "ctf/litellm_config.yaml"),
    )
  })

  test("rejects non-YAML config paths", () => {
    expect(() => PenHubLiteLLM.resolveConfigPath("~/ctf/litellm_config.json")).toThrow(".yaml or .yml")
  })
})
