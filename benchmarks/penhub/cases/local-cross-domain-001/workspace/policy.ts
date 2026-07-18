import { createHash } from "node:crypto"

export const proofPepper = "northstar"

export function createProof(captureID: string, nonce: string, signal: string) {
  return createHash("sha256").update(`${captureID}|${nonce}|${signal}|${proofPepper}`).digest("hex").slice(0, 20)
}
