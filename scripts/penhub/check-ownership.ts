import { $ } from "bun"
import { checkOwnedPaths } from "./ownership"

const codexId = process.env.CODEX_ID
if (!codexId) {
  console.error("CODEX_ID is required. Use CODEX_ID=1, CODEX_ID=2, or CODEX_ID=3.")
  process.exit(1)
}

const base = process.env.PENHUB_OWNERSHIP_BASE ?? "origin/codex/1-core-runtime"
const range = `${base}...HEAD`
const diffFiles = (await $`git diff --name-only ${range}`.quiet().text()).split("\n").filter(Boolean)
const untrackedFiles = (await $`git ls-files --others --exclude-standard`.quiet().text()).split("\n").filter(Boolean)
const changedFiles = [...new Set([...diffFiles, ...untrackedFiles])]
const blocked = checkOwnedPaths({ codexId, changedFiles })

if (blocked.length > 0) {
  console.error(`PenHub ownership check failed for Codex ${codexId}. Out-of-scope files:`)
  blocked.forEach((file) => console.error(`- ${file}`))
  process.exit(1)
}

console.log(`PenHub ownership check passed for Codex ${codexId} (${changedFiles.length} changed files).`)
