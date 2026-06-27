import { describe, expect, test } from "bun:test"
import { samplePenHubWorkspace } from "./samplePenHubState"
import { createPenHubDashboardSummary } from "./dashboard-summary"

describe("PenHub dashboard summary", () => {
  test("summarizes challenge state for the workspace panels", () => {
    const summary = createPenHubDashboardSummary(samplePenHubWorkspace.workspace)

    expect(summary.challengeName).toBe("Local Web Chain 001")
    expect(summary.openHypotheses).toBe(2)
    expect(summary.confirmedHypotheses).toBe(1)
    expect(summary.failedBranches).toBe(1)
    expect(summary.evidenceItems).toBe(6)
    expect(summary.tokensTotal).toBe(30_000)
    expect(summary.nextBranch?.id).toBe("branch_auth_bypass")
  })

  test("keeps fixture data marked as sample data", () => {
    expect(samplePenHubWorkspace.isSampleData).toBe(true)
    expect(samplePenHubWorkspace.benchmark.isSampleData).toBe(true)
  })
})
