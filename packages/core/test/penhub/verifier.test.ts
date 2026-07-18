import { describe, expect } from "bun:test"
import { createHash } from "node:crypto"
import { Effect } from "effect"
import { PenHubRunController, PenHubRunStore, PenHubVerifier } from "@opencode-ai/core/penhub/index"
import { AppProcess } from "@opencode-ai/core/process"
import { testEffect } from "../lib/effect"
import { tempWorkspace } from "./helper"

const it = testEffect(AppProcess.defaultLayer)

describe("PenHub executable verification", () => {
  it.effect("marks a run solved only after its configured oracle accepts", () =>
    Effect.gen(function* () {
      const workspace = yield* Effect.promise(() => tempWorkspace())
      const appProcess = yield* AppProcess.Service
      yield* Effect.promise(() =>
        PenHubRunStore.initialize(workspace, {
          goal: "Recover the exact flag",
          sessionId: "session-test",
        }),
      )
      yield* Effect.promise(() =>
        PenHubRunController.addBranch(workspace, {
          claim: "The candidate is the flag.",
          nextTest: "Run the exact oracle.",
          expectedSignal: "The oracle exits successfully.",
        }),
      )

      const rejected = yield* PenHubVerifier.verify(
        appProcess,
        workspace,
        {
          candidate: "FLAG{plausible_but_wrong}",
          claim: "Wrong candidate",
          artifactPaths: [],
        },
        { kind: "exact", expectedSha256: sha256("FLAG{verified}") },
      )
      expect(rejected.verified).toBe(false)
      expect((yield* Effect.promise(() => PenHubRunStore.read(workspace)))?.status).toBe("active")

      const accepted = yield* PenHubVerifier.verify(
        appProcess,
        workspace,
        {
          candidate: "FLAG{verified}",
          claim: "Recovered the exact challenge flag.",
          artifactPaths: [],
        },
        { kind: "exact", expectedSha256: sha256("FLAG{verified}") },
      )
      expect(accepted.verified).toBe(true)
      const run = yield* Effect.promise(() => PenHubRunStore.read(workspace))
      expect(run?.status).toBe("solved")
      expect(run?.milestoneIds).toContain("final-goal-verified")
      expect(run?.findings[0]).toMatchObject({
        claim: "Recovered the exact challenge flag.",
        verificationMethod: "exact expected result",
      })
      expect(run?.findings[0]?.artifactPaths).toContain(accepted.artifactPath!)
    }),
  )
})

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}
