import { readFile } from "node:fs/promises"
import { describe, expect, test } from "bun:test"
import { FileAttackStateStore, generateMarkdownReport } from "@opencode-ai/core/penhub/index"
import { branch, challenge, evidence, fact, hypothesis, tempWorkspace } from "../helper"

describe("PenHub markdown report", () => {
  test("generates report sections from structured state", async () => {
    const workspace = await tempWorkspace()
    const store = new FileAttackStateStore(workspace)
    await store.initChallenge(challenge(workspace))
    await store.appendFact(fact({ id: "fact_1", claim: "Admin endpoint is reachable.", evidenceIds: ["ev_1"] }))
    await store.appendHypothesis(hypothesis({ id: "hyp_1", status: "confirmed", claim: "Admin access is validated." }))
    await store.appendBranch(
      branch({
        id: "br_1",
        status: "confirmed",
        goal: "Validate admin endpoint.",
        evidenceIds: ["ev_1"],
        hypothesisIds: ["hyp_1"],
      }),
    )
    await store.appendEvidence(evidence({ id: "ev_1", type: "flag", summary: "Final result / flag: flag{demo}" }))

    const report = await generateMarkdownReport({ workspacePath: workspace })
    const markdown = await readFile(report.reportPath, "utf8")

    expect(markdown).toContain("## Summary")
    expect(markdown).toContain("## Final Result / Flag")
    expect(markdown).toContain("flag{demo}")
    expect(markdown).toContain("## Replay Steps")
    expect(markdown).toContain("| ev_1 | flag |")
  })
})
