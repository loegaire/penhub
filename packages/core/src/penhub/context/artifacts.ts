export * as PenHubArtifacts from "./artifacts"

import path from "node:path"
import { realpath } from "node:fs/promises"
import { statePaths } from "../state-paths"

export type ReadInput = {
  path: string
  mode: "head" | "tail" | "lines" | "grep"
  offset?: number
  limit?: number
  pattern?: string
}

export async function read(workspace: string, input: ReadInput) {
  const root = await realpath(path.resolve(statePaths(workspace).artifacts))
  const target = await realpath(path.resolve(workspace, input.path))
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("PenHub artifact reads must stay inside .penhub/artifacts")
  }
  const lines = (await Bun.file(target).text()).split(/\r?\n/)
  const limit = Math.min(500, Math.max(1, input.limit ?? 100))
  const offset = Math.max(0, input.offset ?? 0)
  const selected = (() => {
    if (input.mode === "head") return lines.slice(offset, offset + limit)
    if (input.mode === "tail") return lines.slice(Math.max(0, lines.length - offset - limit), lines.length - offset)
    if (input.mode === "lines") return lines.slice(offset, offset + limit)
    if (!input.pattern) throw new Error("Artifact grep mode requires a pattern")
    const pattern = new RegExp(input.pattern)
    return lines
      .map((line, index) => ({ line, index }))
      .filter((item) => pattern.test(item.line))
      .slice(offset, offset + limit)
      .map((item) => `${item.index + 1}:${item.line}`)
  })()
  return {
    path: path.relative(workspace, target),
    mode: input.mode,
    output: selected.join("\n") || "(no matching artifact output)",
    totalLines: lines.length,
    returnedLines: selected.length,
    truncated: selected.length === limit,
  }
}
