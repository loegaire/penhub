import { describe, expect, test } from "bun:test"
import { PENHUB_PANEL_TITLES } from "./panels"

describe("PenHub panel inventory", () => {
  test("includes the attack-state panels required by codex 3", () => {
    expect(PENHUB_PANEL_TITLES).toEqual([
      "Challenge Overview",
      "Attack Graph",
      "Hypotheses",
      "Evidence Timeline",
      "Token Budget",
      "Action Log",
      "Failed Branches",
      "Report Preview",
      "Benchmark Comparison",
    ])
  })
})
