import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { recordEvidence } from "../evidence"
import { statePaths } from "../state-paths"
import type { Evidence } from "../types"

export type CaptureEvidenceInput = {
  workspacePath: string
  type: Evidence["type"]
  summary: string
  rawContent?: string
  artifactPath?: string
  artifactName?: string
  supports?: string[]
  branchId?: string
  hypothesisId?: string
  createdAt?: string
  id?: string
  idGenerator?: () => string
}

export async function captureEvidence(input: CaptureEvidenceInput) {
  const artifactPath =
    input.rawContent === undefined
      ? input.artifactPath
      : await writeEvidenceArtifact({ ...input, rawContent: input.rawContent })
  return recordEvidence({
    workspacePath: input.workspacePath,
    id: input.id,
    idGenerator: input.idGenerator,
    type: input.type,
    summary: input.summary,
    artifactPath,
    supports: input.supports,
    branchId: input.branchId,
    hypothesisId: input.hypothesisId,
    createdAt: input.createdAt,
  })
}

async function writeEvidenceArtifact(input: CaptureEvidenceInput & { rawContent: string }) {
  const evidenceDir = path.join(statePaths(input.workspacePath).artifacts, "evidence")
  await mkdir(evidenceDir, { recursive: true })
  const artifactName = sanitizeArtifactName(input.artifactName ?? `evidence_${(input.idGenerator ?? randomUUID)()}.txt`)
  const artifactPath = path.join(evidenceDir, artifactName)
  await writeFile(artifactPath, input.rawContent, "utf8")
  return artifactPath
}

function sanitizeArtifactName(value: string) {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, "_")
  return sanitized.length ? sanitized : "evidence.txt"
}
