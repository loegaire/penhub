import path from "node:path"

const workspace = process.env.PENHUB_WORKSPACE
if (!workspace) throw new Error("PENHUB_WORKSPACE is required")

const result = Bun.spawnSync([process.execPath, path.join(workspace, "checker.ts"), process.env.PENHUB_CANDIDATE ?? ""])
if (result.exitCode !== 0) {
  console.error("candidate rejected")
  process.exit(1)
}

console.log("candidate accepted")
