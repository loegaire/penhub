import path from "node:path"
import os from "node:os"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { chromium } from "@playwright/test"
import { FileAttackStateStore } from "@opencode-ai/core/penhub/state-store"
import { samplePenHubWorkspace } from "../src/features/penhub/state/samplePenHubState"

const root = path.resolve(import.meta.dir, "../../..")
const output = path.join(root, "packages/penhub-site/public/screenshots")
const workspaceDirectory = await mkdtemp(path.join(os.tmpdir(), "penhub-readme-"))
const workspace = samplePenHubWorkspace.workspace
const store = new FileAttackStateStore(workspaceDirectory)
await store.initChallenge({ ...workspace.challenge, workspacePath: workspaceDirectory })
await Promise.all([
  Bun.write(path.join(workspaceDirectory, ".penhub/state/facts.jsonl"), jsonl(workspace.facts)),
  Bun.write(path.join(workspaceDirectory, ".penhub/state/hypotheses.jsonl"), jsonl(workspace.hypotheses)),
  Bun.write(path.join(workspaceDirectory, ".penhub/state/branches.jsonl"), jsonl(workspace.branches)),
  Bun.write(path.join(workspaceDirectory, ".penhub/state/evidence.jsonl"), jsonl(workspace.evidence)),
  Bun.write(path.join(workspaceDirectory, ".penhub/state/failed_attempts.jsonl"), jsonl(workspace.failedAttempts)),
  mkdir(path.join(workspaceDirectory, "target")),
  mkdir(path.join(workspaceDirectory, "artifacts")),
  Bun.write(path.join(workspaceDirectory, "exploit.py"), "# Reproduction artifact\n"),
  Bun.write(path.join(workspaceDirectory, "notes.md"), "# Investigation notes\n"),
])

const params = new URLSearchParams({ workspace: workspaceDirectory })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })

await page.goto(`http://127.0.0.1:3000/penhub.html?${params}`, { waitUntil: "domcontentloaded" })
await page.getByLabel("PenHub", { exact: true }).waitFor()
await page.getByRole("button", { name: "New security session", exact: true }).click()
await page.waitForTimeout(750)
await page
  .getByRole("button", { name: "Switch workspace", exact: true })
  .locator("span")
  .last()
  .evaluate((element) => (element.textContent = "/workspace/penhub/demo"))
await page.screenshot({ path: path.join(output, "session-cockpit.png"), fullPage: true })
await page.getByRole("button", { name: "Evidence", exact: true }).click()
await page.screenshot({ path: path.join(output, "evidence-view.png"), fullPage: true })

await browser.close()
await rm(workspaceDirectory, { recursive: true })

function jsonl(records: readonly unknown[]) {
  if (records.length === 0) return ""
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`
}
