import { describe, expect, test } from "bun:test"
import { pruneBranches, rankBranches, scoreBranch, selectNextBranch } from "@opencode-ai/core/penhub/index"
import { branch } from "./helper"

describe("PenHub attack tree", () => {
  test("ranks evidence-backed low-waste branches higher", () => {
    const strong = branch({ id: "strong", confidence: 0.8, progress: 0.7, novelty: 0.7, tokenCost: 900, evidenceIds: ["ev_1"] })
    const wasteful = branch({ id: "wasteful", confidence: 0.7, progress: 0.1, novelty: 0.3, tokenCost: 9_000, repetitionPenalty: 0.9 })

    expect(scoreBranch(strong)).toBeGreaterThan(scoreBranch(wasteful))
    expect(rankBranches([wasteful, strong])[0]?.id).toBe("strong")
  })

  test("does not select stale or failed branches", () => {
    const active = branch({ id: "active", status: "active" })
    const stale = branch({ id: "stale", status: "stale" })
    const failed = branch({ id: "failed", status: "failed" })
    expect(pruneBranches([stale, active, failed]).map((item) => item.id)).toEqual(["active"])
    expect(selectNextBranch([stale, active, failed])?.id).toBe("active")
  })
})
