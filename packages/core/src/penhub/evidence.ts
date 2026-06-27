import { createHash, randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { FileAttackStateStore } from "./state-store"
import type { Evidence } from "./types"

export async function hashArtifact(artifactPath: string) {
  return createHash("sha256").update(await readFile(artifactPath)).digest("hex")
}

export async function recordEvidence(input: {
  workspacePath: string
  type: Evidence["type"]
  summary: string
  artifactPath?: string
  supports?: string[]
  branchId?: string
  hypothesisId?: string
  createdAt?: string
}) {
  const evidence: Evidence = {
    id: `ev_${randomUUID()}`,
    type: input.type,
    summary: input.summary,
    supports: input.supports ?? [],
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...(input.artifactPath ? { artifactPath: input.artifactPath, hash: await hashArtifact(input.artifactPath) } : {}),
    ...(input.branchId ? { branchId: input.branchId } : {}),
    ...(input.hypothesisId ? { hypothesisId: input.hypothesisId } : {}),
  }
  await new FileAttackStateStore(input.workspacePath).appendEvidence(evidence)
  return evidence
}
