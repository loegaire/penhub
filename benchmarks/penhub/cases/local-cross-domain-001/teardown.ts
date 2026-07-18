import path from "node:path"

const workspace = process.env.PENHUB_WORKSPACE
if (!workspace) throw new Error("PENHUB_WORKSPACE is required")

const file = Bun.file(path.join(workspace, ".server.pid"))
if (!(await file.exists())) process.exit(0)

const pid = Number(await file.text())
try {
  process.kill(-pid, "SIGTERM")
} catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ESRCH") throw error
}
