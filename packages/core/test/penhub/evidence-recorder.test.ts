import { access } from "node:fs/promises"
import { describe, expect, test } from "bun:test"
import { FileAttackStateStore } from "@opencode-ai/core/penhub/index"
import { captureEvidence } from "@opencode-ai/core/penhub/action-runtime/evidence-recorder"
import { challenge, tempWorkspace } from "./helper"

describe("PenHub evidence recorder", () => {
  test("stores raw evidence as an artifact and records hash-linked evidence", async () => {
    const workspace = await tempWorkspace()
    const store = new FileAttackStateStore(workspace)
    await store.initChallenge(challenge(workspace))

    const evidence = await captureEvidence({
      workspacePath: workspace,
      idGenerator: () => "fixed",
      type: "http",
      summary: "HTTP response proves access.",
      rawContent: "HTTP/1.1 200 OK\n\nflag-like proof",
      artifactName: "http-proof.txt",
      supports: ["fact_1"],
      branchId: "br_1",
      hypothesisId: "hyp_1",
      createdAt: "2026-01-01T00:02:00.000Z",
    })

    expect(evidence.id).toBe("ev_fixed")
    expect(evidence.hash).toHaveLength(64)
    expect(evidence.artifactPath).toEndWith("http-proof.txt")
    await access(evidence.artifactPath!)
    expect((await store.listEvidence({ branchId: "br_1" })).map((item) => item.id)).toEqual(["ev_fixed"])
  })
})
