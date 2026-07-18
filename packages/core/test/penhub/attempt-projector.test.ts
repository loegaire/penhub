import { describe, expect } from "bun:test"
import { DateTime, Effect, Layer } from "effect"
import { EventV2 } from "@opencode-ai/core/event"
import { Location } from "@opencode-ai/core/location"
import { PenHubAttemptProjector, PenHubRunController, PenHubRunStore } from "@opencode-ai/core/penhub/index"
import { SessionEvent } from "@opencode-ai/core/session/event"
import { SessionMessage } from "@opencode-ai/core/session/message"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { tempLocationLayer } from "../fixture/location"
import { testEffect } from "../lib/effect"

const layer = PenHubAttemptProjector.layer.pipe(
  Layer.provideMerge(EventV2.defaultLayer),
  Layer.provideMerge(tempLocationLayer),
)
const it = testEffect(layer)

describe("PenHub attempt projector", () => {
  it.effect("projects every settled Session V2 tool call without a model logging action", () =>
    Effect.gen(function* () {
      const events = yield* EventV2.Service
      const location = yield* Location.Service
      const sessionID = SessionSchema.ID.create()
      const assistantMessageID = SessionMessage.ID.create()
      yield* Effect.promise(() =>
        PenHubRunStore.initialize(location.directory, { goal: "Observe the target", sessionId: sessionID }),
      )
      const branch = yield* Effect.promise(() =>
        PenHubRunController.addBranch(location.directory, {
          claim: "The target responds.",
          nextTest: "Send one probe.",
          expectedSignal: "A response status is returned.",
        }),
      )
      const timestamp = yield* DateTime.now
      yield* events.publish(SessionEvent.Tool.Called, {
        sessionID,
        timestamp,
        assistantMessageID,
        callID: "call-probe",
        tool: "sec_probe",
        input: { target: "local" },
        provider: { executed: false },
      })
      yield* events.publish(SessionEvent.Tool.Success, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID: "call-probe",
        structured: {
          status: "success",
          artifactPath: ".penhub/artifacts/tool-runs/probe.log",
          durationMs: 37,
          outputBytes: 9_000,
        },
        content: [{ type: "text", text: "target returned 200" }],
        provider: { executed: false },
      })

      yield* events.publish(SessionEvent.Tool.Called, {
        sessionID,
        timestamp,
        assistantMessageID,
        callID: "call-timeout",
        tool: "sec_probe",
        input: { target: "slow" },
        provider: { executed: false },
      })
      yield* events.publish(SessionEvent.Tool.Failed, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        callID: "call-timeout",
        error: { type: "unknown", message: "probe timed out" },
        provider: { executed: false },
      })
      yield* events.publish(SessionEvent.Step.Ended, {
        sessionID,
        timestamp: yield* DateTime.now,
        assistantMessageID,
        finish: "tool-calls",
        cost: 0,
        tokens: { input: 10, output: 4, reasoning: 2, cache: { read: 3, write: 1 } },
      })

      const attempts = yield* Effect.promise(() => PenHubRunStore.listAttempts(location.directory))
      expect(attempts).toHaveLength(2)
      expect(attempts[0]).toMatchObject({
        callId: "call-probe",
        branchId: branch.id,
        tool: "sec_probe",
        status: "success",
        observation: "target returned 200",
        artifactPath: ".penhub/artifacts/tool-runs/probe.log",
        durationMs: 37,
        outputBytes: 9_000,
      })
      expect(attempts[1]?.status).toBe("timeout")
      expect(yield* Effect.promise(() => PenHubRunStore.read(location.directory))).toMatchObject({
        attemptCount: 2,
        providerTurns: 1,
        tokenCount: 20,
      })
    }),
  )
})
