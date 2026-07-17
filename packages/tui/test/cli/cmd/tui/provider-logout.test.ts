import { describe, expect, test } from "bun:test"
import type { IntegrationInfo } from "@opencode-ai/sdk/v2"
import { providerCredentials } from "../../../../src/component/dialog-provider-logout"

describe("providerCredentials", () => {
  test("lists stored credentials and excludes environment connections", () => {
    const integrations = [
      {
        id: "opencode",
        name: "OpenCode",
        methods: [],
        connections: [
          { type: "credential", id: "cred_2", label: "Work" },
          { type: "credential", id: "cred_1", label: "Personal" },
        ],
      },
      {
        id: "anthropic",
        name: "Anthropic",
        methods: [],
        connections: [{ type: "env", name: "ANTHROPIC_API_KEY" }],
      },
    ] satisfies IntegrationInfo[]

    expect(providerCredentials(integrations)).toEqual([
      {
        credentialID: "cred_1",
        providerID: "opencode",
        providerName: "OpenCode",
        label: "Personal",
      },
      {
        credentialID: "cred_2",
        providerID: "opencode",
        providerName: "OpenCode",
        label: "Work",
      },
    ])
  })
})
