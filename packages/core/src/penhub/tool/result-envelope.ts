export * as PenHubToolResult from "./result-envelope"

import { Schema } from "effect"
import { NonNegativeInt } from "../../schema"

export const Envelope = Schema.Struct({
  id: Schema.String,
  tool: Schema.String,
  status: Schema.Literals(["success", "error", "timeout"]),
  exitCode: Schema.Number.pipe(Schema.optional),
  summary: Schema.String,
  artifactPath: Schema.String.pipe(Schema.optional),
  durationMs: NonNegativeInt,
  outputBytes: NonNegativeInt,
})
export type Envelope = typeof Envelope.Type
