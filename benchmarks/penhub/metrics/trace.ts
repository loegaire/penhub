import { createHash } from "node:crypto"

export type CliEvent = {
  type: string
  timestamp?: number
  sessionID?: string
  part?: {
    type?: string
    text?: string
    tool?: string
    reason?: string
    tokens?: {
      input?: number
      output?: number
      reasoning?: number
      cache?: { read?: number; write?: number }
    }
    state?: {
      status?: string
      input?: unknown
      output?: unknown
      error?: unknown
    }
  }
}

export function parseCliEvents(output: string) {
  return output
    .split("\n")
    .filter(Boolean)
    .map((line, index) => {
      try {
        return parseEvent(JSON.parse(line))
      } catch (error) {
        throw new Error(`Invalid CLI event at output line ${index + 1}`, { cause: error })
      }
    })
}

function parseEvent(input: unknown): CliEvent {
  if (!isRecord(input) || typeof input.type !== "string") throw new Error("CLI event must contain a type")
  return {
    type: input.type,
    ...(typeof input.timestamp === "number" ? { timestamp: input.timestamp } : {}),
    ...(typeof input.sessionID === "string" ? { sessionID: input.sessionID } : {}),
    ...(isRecord(input.part) ? { part: parsePart(input.part) } : {}),
  }
}

function parsePart(input: Record<string, unknown>): NonNullable<CliEvent["part"]> {
  return {
    ...(typeof input.type === "string" ? { type: input.type } : {}),
    ...(typeof input.text === "string" ? { text: input.text } : {}),
    ...(typeof input.tool === "string" ? { tool: input.tool } : {}),
    ...(typeof input.reason === "string" ? { reason: input.reason } : {}),
    ...(isRecord(input.tokens)
      ? {
          tokens: {
            ...(typeof input.tokens.input === "number" ? { input: input.tokens.input } : {}),
            ...(typeof input.tokens.output === "number" ? { output: input.tokens.output } : {}),
            ...(typeof input.tokens.reasoning === "number" ? { reasoning: input.tokens.reasoning } : {}),
            ...(isRecord(input.tokens.cache)
              ? {
                  cache: {
                    ...(typeof input.tokens.cache.read === "number" ? { read: input.tokens.cache.read } : {}),
                    ...(typeof input.tokens.cache.write === "number" ? { write: input.tokens.cache.write } : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(isRecord(input.state)
      ? {
          state: {
            ...(typeof input.state.status === "string" ? { status: input.state.status } : {}),
            ...(Object.hasOwn(input.state, "input") ? { input: input.state.input } : {}),
            ...(Object.hasOwn(input.state, "output") ? { output: input.state.output } : {}),
            ...(Object.hasOwn(input.state, "error") ? { error: input.state.error } : {}),
          },
        }
      : {}),
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input)
}

export function summarizeCliEvents(events: CliEvent[], resultPattern: string) {
  const toolCalls = events
    .filter((event) => event.type === "tool_use" && event.part?.tool)
    .map((event) => ({
      tool: event.part?.tool ?? "unknown",
      status: event.part?.state?.status ?? "unknown",
      input: event.part?.state?.input,
    }))
  const textEvents = events.filter((event) => event.type === "text" && event.part?.text)
  const candidateEvent = textEvents.find((event) => new RegExp(resultPattern).test(event.part?.text ?? ""))
  return {
    sessionID: events.find((event) => event.sessionID)?.sessionID,
    text: textEvents.map((event) => event.part?.text).join("\n\n"),
    candidate: candidateEvent?.part?.text?.match(new RegExp(resultPattern))?.[0],
    candidateTimestamp: candidateEvent?.timestamp,
    toolCalls,
    toolErrors: toolCalls.filter((item) => item.status === "error").length,
    fingerprints: toolCalls.map((item) => digest(`${item.tool}:${stableJson(item.input)}`)),
    finishReasons: events
      .filter((event) => event.type === "step_finish" && event.part?.reason)
      .map((event) => event.part?.reason ?? "unknown"),
    tokens: events
      .filter((event) => event.type === "step_finish")
      .reduce(
        (total, event) => ({
          input: total.input + (event.part?.tokens?.input ?? 0) + (event.part?.tokens?.cache?.read ?? 0),
          output: total.output + (event.part?.tokens?.output ?? 0),
          reasoning: total.reasoning + (event.part?.tokens?.reasoning ?? 0),
        }),
        { input: 0, output: 0, reasoning: 0 },
      ),
  }
}

export function digest(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (!value || typeof value !== "object") return JSON.stringify(value) ?? "undefined"
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(",")}}`
}
