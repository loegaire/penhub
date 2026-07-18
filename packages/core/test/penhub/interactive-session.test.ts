import { describe, expect } from "bun:test"
import path from "node:path"
import { Config } from "@opencode-ai/core/config"
import { EventV2 } from "@opencode-ai/core/event"
import { Location } from "@opencode-ai/core/location"
import { InteractiveSession } from "@opencode-ai/core/penhub/tool/interactive-session"
import { Pty } from "@opencode-ai/core/pty"
import { Effect, Layer } from "effect"
import { tempLocationLayer } from "../fixture/location"
import { testEffect } from "../lib/effect"

const layer = Pty.layer.pipe(
  Layer.provide(Layer.mock(Config.Service)({ entries: () => Effect.succeed([]) })),
  Layer.provideMerge(EventV2.defaultLayer),
  Layer.provideMerge(tempLocationLayer),
)
const it = testEffect(layer)
const ptyTest = process.platform === "win32" ? it.live.skip : it.live

describe("PenHub interactive sessions", () => {
  ptyTest("preserves process state and retains a transcript artifact", () =>
    Effect.gen(function* () {
      const command = Bun.which("cat")
      if (!command) throw new Error("cat is required for this test")
      const pty = yield* Pty.Service
      const location = yield* Location.Service
      const interactive = InteractiveSession.make({
        pty,
        workspace: location.directory,
        prepare: () => Effect.succeed({ command, args: [], runtime: "docker", image: "controlled-test" }),
      })
      yield* Effect.addFinalizer(() => interactive.close())

      const started = yield* interactive.start({ pack: "binary", command: "cat", args: [] })
      expect(started).toMatchObject({
        tool: "sec_session_start",
        status: "success",
        sessionStatus: "running",
        outputBytes: 0,
      })
      yield* interactive.write({ sessionId: started.sessionId, data: "first observation\n" })
      yield* interactive.write({ sessionId: started.sessionId, data: "second observation\n" })
      yield* Effect.sleep("50 millis")
      const read = yield* interactive.read({ sessionId: started.sessionId, cursor: 0 })

      expect(read.status).toBe("success")
      expect(read.sessionStatus).toBe("running")
      expect(read.tool).toBe("sec_session_read")
      expect(read.outputBytes).toBeGreaterThan(0)
      expect(read.output).toContain("first observation")
      expect(read.output).toContain("second observation")
      expect(read.cursor).toBeGreaterThan(0)

      const stopped = yield* interactive.stop({ sessionId: started.sessionId })
      const transcript = yield* Effect.promise(() =>
        Bun.file(path.join(location.directory, stopped.artifactPath)).text(),
      )
      expect(transcript).toContain("first observation")
      expect(transcript).toContain("second observation")
    }),
  )
})
