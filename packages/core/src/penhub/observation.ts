import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"

export type CompressedObservation = {
  includeInContext: boolean
  compressedSummary: string
  rawOutputPath?: string
}

export async function compressObservation(input: {
  workspacePath: string
  rawOutput: string
  rawOutputId?: string
  idGenerator?: () => string
  maxInlineChars?: number
  maxSummaryChars?: number
}): Promise<CompressedObservation> {
  const maxInlineChars = input.maxInlineChars ?? 2_000
  const maxSummaryChars = input.maxSummaryChars ?? 1_000
  const normalized = input.rawOutput.replace(/\s+/g, " ").trim()
  const compressedSummary = normalized.slice(0, maxSummaryChars)
  if (input.rawOutput.length <= maxInlineChars) {
    return { includeInContext: true, compressedSummary }
  }

  const rawDir = path.join(input.workspacePath, ".penhub", "artifacts", "raw")
  await mkdir(rawDir, { recursive: true })
  const rawOutputPath = path.join(rawDir, `raw_${input.rawOutputId ?? (input.idGenerator ?? randomUUID)()}.txt`)
  await writeFile(rawOutputPath, input.rawOutput, "utf8")
  return { includeInContext: false, compressedSummary, rawOutputPath }
}
