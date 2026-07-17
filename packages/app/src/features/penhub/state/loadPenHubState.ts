import type { OpenCode } from "@opencode-ai/client"

export async function loadPenHubState(client: ReturnType<typeof OpenCode.make>) {
  const state = await client["server.penhub"].get()
  const [tools, sessions, active] = await Promise.all([
    client["server.penhub"].list(),
    client.sessions.list({ directory: state.location.directory, limit: 50, order: "desc" }),
    client.sessions.active(),
  ])
  return { state, tools, sessions, active }
}
