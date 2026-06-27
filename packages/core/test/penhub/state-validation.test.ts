import { writeFile } from "node:fs/promises"
import { describe, expect, test } from "bun:test"
import { FileAttackStateStore, statePaths } from "@opencode-ai/core/penhub/index"
import { challenge, fact, tempWorkspace } from "./helper"

describe("PenHub state validation", () => {
  test("rejects invalid challenge state before initialization", async () => {
    const workspace = await tempWorkspace()
    const store = new FileAttackStateStore(workspace)

    await expectRejected(store.initChallenge({ ...challenge(workspace), goal: "" }), "goal is required")
  })

  test("rejects invalid records before append", async () => {
    const workspace = await tempWorkspace()
    const store = new FileAttackStateStore(workspace)
    await store.initChallenge(challenge(workspace))

    await expectRejected(store.appendFact(fact({ confidence: 1.2 })), "confidence must be between 0 and 1")
  })

  test("reports malformed JSONL with file and line details", async () => {
    const workspace = await tempWorkspace()
    const store = new FileAttackStateStore(workspace)
    await store.initChallenge(challenge(workspace))

    const paths = statePaths(workspace)
    await writeFile(paths.facts, '{"id": "fact_1"\n', "utf8")

    await expectRejected(store.listFacts(), `Invalid PenHub JSONL at ${paths.facts}:1`)
  })

  test("reports persisted schema errors with file and line details", async () => {
    const workspace = await tempWorkspace()
    const store = new FileAttackStateStore(workspace)
    await store.initChallenge(challenge(workspace))

    const paths = statePaths(workspace)
    await writeFile(paths.facts, JSON.stringify(fact({ confidence: 2 })) + "\n", "utf8")

    await expectRejected(store.listFacts(), `Invalid PenHub fact record at ${paths.facts}:1`)
  })

  test("reports missing challenge state explicitly", async () => {
    const workspace = await tempWorkspace()
    const store = new FileAttackStateStore(workspace)

    await expectRejected(store.readChallenge(), "PenHub challenge state is missing")
  })
})

async function expectRejected(promise: Promise<unknown>, message: string) {
  try {
    await promise
  } catch (error) {
    expect(error instanceof Error ? error.message : String(error)).toContain(message)
    return
  }
  throw new Error(`Expected promise to reject with: ${message}`)
}
