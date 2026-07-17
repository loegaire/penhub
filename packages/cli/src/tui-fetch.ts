import type { IntegrationInfo, ModelV2Info, ProviderV2Info } from "@opencode-ai/sdk/v2"

const legacyDefaults: Record<string, unknown> = {
  "/agent": [],
  "/config": {},
}

export function createTuiFetch(baseFetch: typeof fetch = fetch) {
  const attempts = new Map<string, { attemptID: string; expires: number }>()
  const compatible = async (request: Request, response: Response) => {
    const url = new URL(request.url)
    if (request.method === "GET" && url.pathname === "/config/providers") {
      const [providers, models] = await Promise.all([
        v2<ProviderV2Info[]>(request, "/api/provider"),
        v2<ModelV2Info[]>(request, "/api/model"),
      ])
      if (providers instanceof Response) return providers
      if (models instanceof Response) return models
      return Response.json({ providers: legacyProviders(providers, models), default: {} })
    }
    if (request.method === "GET" && url.pathname === "/provider") {
      const [integrations, providers, models] = await Promise.all([
        v2<IntegrationInfo[]>(request, "/api/integration"),
        v2<ProviderV2Info[]>(request, "/api/provider"),
        v2<ModelV2Info[]>(request, "/api/model"),
      ])
      if (integrations instanceof Response) return integrations
      if (providers instanceof Response) return providers
      if (models instanceof Response) return models
      const available = legacyProviders(providers, models)
      return Response.json({
        all: integrations
          .filter((integration) => integration.methods.some((method) => method.type !== "env"))
          .map(
            (integration) =>
              available.find((provider) => provider.id === integration.id) ?? {
                id: integration.id,
                name: integration.name,
                source: "api",
                env: [],
                options: {},
                models: {},
              },
          ),
        default: {},
        connected: integrations
          .filter((integration) => integration.connections.length > 0)
          .map((integration) => integration.id),
      })
    }
    if (request.method === "GET" && url.pathname === "/provider/auth") {
      const integrations = await v2<IntegrationInfo[]>(request, "/api/integration")
      if (integrations instanceof Response) return integrations
      return Response.json(
        Object.fromEntries(
          integrations.map((integration) => [
            integration.id,
            integration.methods.flatMap((method) => {
              if (method.type === "env") return []
              if (method.type === "key") return [{ type: "api", label: method.label ?? "API key" }]
              return [{ type: "oauth", label: method.label, prompts: method.prompts }]
            }),
          ]),
        ),
      )
    }

    const auth = url.pathname.match(/^\/auth\/([^/]+)$/)
    if (request.method === "PUT" && auth) {
      const body = (await request.json()) as { type?: string; key?: string; metadata?: { label?: string } }
      if (body.type !== "api" || !body.key) return response
      const result = await v2(request, `/api/integration/${encodeURIComponent(auth[1])}/connect/key`, {
        method: "POST",
        body: JSON.stringify({ key: body.key, label: body.metadata?.label }),
      })
      if (result instanceof Response) return result
      return Response.json(true)
    }

    const authorize = url.pathname.match(/^\/provider\/([^/]+)\/oauth\/authorize$/)
    if (request.method === "POST" && authorize) {
      const body = (await request.json()) as { method?: number; inputs?: Record<string, string> }
      const integrations = await v2<IntegrationInfo[]>(request, "/api/integration")
      if (integrations instanceof Response) return integrations
      const integration = integrations.find((integration) => integration.id === authorize[1])
      const method = integration?.methods.filter((method) => method.type !== "env")[body.method ?? 0]
      if (method?.type !== "oauth") return response
      const result = await v2<{
        attemptID: string
        url: string
        instructions: string
        mode: "auto" | "code"
        time: { expires: number }
      }>(request, `/api/integration/${encodeURIComponent(authorize[1])}/connect/oauth`, {
        method: "POST",
        body: JSON.stringify({ methodID: method.id, inputs: body.inputs ?? {} }),
      })
      if (result instanceof Response) return result
      attempts.set(`${authorize[1]}:${body.method ?? 0}`, { attemptID: result.attemptID, expires: result.time.expires })
      return Response.json({ url: result.url, method: result.mode, instructions: result.instructions })
    }

    const callback = url.pathname.match(/^\/provider\/([^/]+)\/oauth\/callback$/)
    if (request.method === "POST" && callback) {
      const body = (await request.json()) as { method?: number; code?: string }
      const key = `${callback[1]}:${body.method ?? 0}`
      const attempt = attempts.get(key)
      if (!attempt) return response
      if (body.code !== undefined) {
        const result = await v2(request, `/api/integration/attempt/${encodeURIComponent(attempt.attemptID)}/complete`, {
          method: "POST",
          body: JSON.stringify({ code: body.code }),
        })
        if (result instanceof Response) return result
        attempts.delete(key)
        return Response.json(true)
      }
      while (Date.now() < attempt.expires) {
        const result = await v2<{ status: "pending" | "complete" | "failed" | "expired"; message?: string }>(
          request,
          `/api/integration/attempt/${encodeURIComponent(attempt.attemptID)}`,
        )
        if (result instanceof Response) return result
        if (result.status === "complete") {
          attempts.delete(key)
          return Response.json(true)
        }
        if (result.status !== "pending")
          return Response.json({ message: result.message ?? result.status }, { status: 400 })
        await Bun.sleep(500)
      }
      return Response.json({ message: "Provider authorization expired" }, { status: 400 })
    }

    const fallback = legacyDefaults[url.pathname]
    if (fallback === undefined) return response
    return Response.json(fallback)
  }

  async function v2<T>(request: Request, pathname: string, init?: RequestInit) {
    const url = new URL(request.url)
    url.pathname = pathname
    url.search = ""
    const headers = new Headers(request.headers)
    const directory = new URL(request.url).searchParams.get("directory")
    const workspace = new URL(request.url).searchParams.get("workspace")
    if (directory) headers.set("x-opencode-directory", encodeURIComponent(directory))
    if (workspace) headers.set("x-opencode-workspace", workspace)
    if (init?.body) headers.set("content-type", "application/json")
    const result = await baseFetch(url, { ...init, headers })
    if (!result.ok) return result
    if (result.status === 204) return undefined as T
    return ((await result.json()) as { data: T }).data
  }

  return Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      const response = await baseFetch(request.clone())
      if (response.status !== 404) return response
      return compatible(request, response)
    },
    { preconnect: fetch.preconnect },
  )
}

function legacyProviders(providers: ProviderV2Info[], models: ModelV2Info[]) {
  return providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    source: "api",
    env: [],
    options: {},
    models: Object.fromEntries(
      models.filter((model) => model.providerID === provider.id).map((model) => [model.id, legacyModel(model)]),
    ),
  }))
}

function legacyModel(model: ModelV2Info) {
  const cost = model.cost.find((cost) => cost.tier === undefined) ?? model.cost[0]
  const released = new Date(model.time.released < 10_000_000_000 ? model.time.released * 1_000 : model.time.released)
  return {
    id: model.id,
    providerID: model.providerID,
    api: {
      id: model.api.id,
      url: model.api.url ?? "",
      npm: model.api.type === "aisdk" ? model.api.package : "",
    },
    name: model.name,
    family: model.family,
    capabilities: {
      temperature: true,
      reasoning: model.capabilities.output.includes("reasoning"),
      attachment: model.capabilities.input.some((type) => type !== "text"),
      toolcall: model.capabilities.tools,
      input: Object.fromEntries(
        ["text", "audio", "image", "video", "pdf"].map((type) => [type, model.capabilities.input.includes(type)]),
      ),
      output: Object.fromEntries(
        ["text", "audio", "image", "video", "pdf"].map((type) => [type, model.capabilities.output.includes(type)]),
      ),
      interleaved: false,
    },
    cost: cost ?? { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: model.limit,
    status: model.status,
    options: model.request.body,
    headers: model.request.headers,
    release_date: Number.isNaN(released.getTime()) ? "1970-01-01" : released.toISOString().slice(0, 10),
    variants: Object.fromEntries(model.variants.map((variant) => [variant.id, variant.body])),
  }
}
