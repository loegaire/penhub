import { spawn } from "node:child_process"
import path from "node:path"

const workspace = process.env.PENHUB_WORKSPACE
if (!workspace) throw new Error("PENHUB_WORKSPACE is required")

const server = spawn(process.execPath, [path.join(workspace, "server.ts")], {
  cwd: workspace,
  detached: true,
  env: { ...process.env, PENHUB_CASE_FLAG: "FLAG{cross_domain_verified}" },
  stdio: "ignore",
})
server.unref()
await Bun.write(path.join(workspace, ".server.pid"), String(server.pid))

const deadline = Date.now() + 10_000
while (!(await Bun.file(path.join(workspace, "target.json")).exists())) {
  if (Date.now() >= deadline) throw new Error("local challenge service did not start")
  await Bun.sleep(25)
}
