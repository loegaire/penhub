import { describe, expect, test } from "bun:test"
import { createTuiFetch } from "./tui-fetch"

describe("TUI V2 compatibility", () => {
  test("lists integrations and connects an API-key provider", async () => {
    const requests: Request[] = []
    const state = { connected: false }
    const fetch = createTuiFetch(
      Object.assign(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init)
          requests.push(request.clone())
          const path = new URL(request.url).pathname
          if (path === "/api/integration" && request.method === "GET")
            return Response.json({
              data: [
                {
                  id: "openai",
                  name: "OpenAI",
                  methods: [{ type: "key", label: "API key" }],
                  connections: state.connected ? [{ type: "credential", id: "cred_1", label: "OpenAI" }] : [],
                },
              ],
            })
          if (path === "/api/provider" && request.method === "GET")
            return Response.json({
              data: state.connected
                ? [
                    {
                      id: "openai",
                      integrationID: "openai",
                      name: "OpenAI",
                      api: { type: "aisdk", package: "@ai-sdk/openai" },
                      request: { headers: {}, body: {} },
                    },
                  ]
                : [],
            })
          if (path === "/api/model" && request.method === "GET")
            return Response.json({
              data: state.connected
                ? [
                    {
                      id: "gpt-test",
                      providerID: "openai",
                      name: "GPT Test",
                      api: { id: "gpt-test", type: "aisdk", package: "@ai-sdk/openai" },
                      capabilities: { tools: true, input: ["text"], output: ["text"] },
                      request: { headers: {}, body: {} },
                      variants: [],
                      time: { released: 1_700_000_000_000 },
                      cost: [{ input: 1, output: 2, cache: { read: 0, write: 0 } }],
                      status: "active",
                      enabled: true,
                      limit: { context: 128_000, output: 8_192 },
                    },
                  ]
                : [],
            })
          if (path === "/api/integration/openai/connect/key" && request.method === "POST") {
            state.connected = true
            expect(await request.json()).toEqual({ key: "secret" })
            return new Response(undefined, { status: 204 })
          }
          return new Response("missing", { status: 404 })
        },
        { preconnect: () => undefined },
      ) satisfies typeof globalThis.fetch,
    )

    const before = await fetch("http://localhost/provider")
    expect(await before.json()).toEqual({
      all: [{ id: "openai", name: "OpenAI", source: "api", env: [], options: {}, models: {} }],
      default: {},
      connected: [],
    })

    const auth = await fetch("http://localhost/provider/auth")
    expect(await auth.json()).toEqual({ openai: [{ type: "api", label: "API key" }] })

    const connect = await fetch("http://localhost/auth/openai", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "api", key: "secret" }),
    })
    expect(await connect.json()).toBe(true)

    const providers = await fetch("http://localhost/config/providers")
    const configured = (await providers.json()) as {
      providers: { id: string; models: Record<string, { name: string; capabilities: { toolcall: boolean } }> }[]
    }
    expect(configured.providers[0].id).toBe("openai")
    expect(configured.providers[0].models["gpt-test"].name).toBe("GPT Test")
    expect(configured.providers[0].models["gpt-test"].capabilities.toolcall).toBe(true)
    expect(requests.some((request) => new URL(request.url).pathname === "/api/integration/openai/connect/key")).toBe(
      true,
    )
  })

  test("completes a code-based OAuth provider connection", async () => {
    const requests: Request[] = []
    const fetch = createTuiFetch(
      Object.assign(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init)
          requests.push(request.clone())
          const path = new URL(request.url).pathname
          if (path === "/api/integration" && request.method === "GET")
            return Response.json({
              data: [
                {
                  id: "openai",
                  name: "OpenAI",
                  methods: [{ id: "browser", type: "oauth", label: "Browser" }],
                  connections: [],
                },
              ],
            })
          if (path === "/api/integration/openai/connect/oauth" && request.method === "POST") {
            expect(await request.json()).toEqual({ methodID: "browser", inputs: {} })
            return Response.json({
              data: {
                attemptID: "attempt_1",
                url: "https://example.com/login",
                instructions: "Paste the code",
                mode: "code",
                time: { created: 1, expires: Date.now() + 60_000 },
              },
            })
          }
          if (path === "/api/integration/attempt/attempt_1/complete" && request.method === "POST") {
            expect(await request.json()).toEqual({ code: "oauth-code" })
            return new Response(undefined, { status: 204 })
          }
          return new Response("missing", { status: 404 })
        },
        { preconnect: () => undefined },
      ) satisfies typeof globalThis.fetch,
    )

    const authorize = await fetch("http://localhost/provider/openai/oauth/authorize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: 0 }),
    })
    expect(await authorize.json()).toEqual({
      url: "https://example.com/login",
      method: "code",
      instructions: "Paste the code",
    })

    const callback = await fetch("http://localhost/provider/openai/oauth/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: 0, code: "oauth-code" }),
    })
    expect(await callback.json()).toBe(true)
    expect(
      requests.some((request) => new URL(request.url).pathname.endsWith("/api/integration/attempt/attempt_1/complete")),
    ).toBe(true)
  })
})
