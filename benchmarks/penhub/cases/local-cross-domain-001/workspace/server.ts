import { createProof } from "./policy"

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const url = new URL(request.url)
    if (request.method !== "POST" || url.pathname !== "/api/recover") return new Response("not found", { status: 404 })

    const payload = await request.json().catch(() => undefined)
    if (!payload || typeof payload !== "object" || !("nonce" in payload) || !("signal" in payload)) {
      return Response.json({ error: "invalid body" }, { status: 400 })
    }
    const captureID = request.headers.get("x-capture-id") ?? ""
    const expected = createProof(captureID, String(payload.nonce), String(payload.signal))
    if (request.headers.get("x-penhub-proof") !== expected) {
      return Response.json({ error: "invalid proof" }, { status: 403 })
    }
    return Response.json({ result: process.env.PENHUB_CASE_FLAG ?? "missing case flag" })
  },
})

await Bun.write("target.json", JSON.stringify({ baseUrl: server.url.origin }) + "\n")
