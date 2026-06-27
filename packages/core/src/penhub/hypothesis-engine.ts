import { randomUUID } from "node:crypto"
import type { AttackStateStore } from "./state-store"
import type { Hypothesis, HypothesisStatus } from "./types"

const transitions: Record<HypothesisStatus, HypothesisStatus[]> = {
  open: ["testing", "stale"],
  testing: ["confirmed", "failed", "stale"],
  confirmed: ["stale"],
  failed: ["stale"],
  stale: [],
}

export class HypothesisEngine {
  constructor(
    private readonly store: AttackStateStore,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly idGenerator: () => string = randomUUID,
  ) {}

  async create(input: {
    claim: string
    requiredEvidence: string[]
    nextTest?: string
    confidence?: number
    branchId?: string
  }) {
    const timestamp = this.now()
    const hypothesis: Hypothesis = {
      id: `hyp_${this.idGenerator()}`,
      claim: input.claim,
      status: "open",
      requiredEvidence: input.requiredEvidence,
      confidence: input.confidence ?? 0.5,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(input.nextTest ? { nextTest: input.nextTest } : {}),
      ...(input.branchId ? { branchId: input.branchId } : {}),
    }
    await this.store.appendHypothesis(hypothesis)
    return hypothesis
  }

  async markTesting(id: string) {
    await this.transition(id, "testing", {})
  }

  async markConfirmed(id: string, evidenceIds: string[]) {
    const hypothesis = await this.readOne(id)
    await this.transition(id, "confirmed", {
      requiredEvidence: [...new Set([...hypothesis.requiredEvidence, ...evidenceIds])],
      confidence: 1,
    })
  }

  async markFailed(id: string, reason: string) {
    const hypothesis = await this.readOne(id)
    await this.transition(id, "failed", {
      nextTest: `failed: ${reason}`,
      confidence: Math.min(hypothesis.confidence, 0.2),
    })
  }

  async markStale(id: string, reason: string) {
    await this.transition(id, "stale", { nextTest: `stale: ${reason}` })
  }

  private async transition(id: string, status: HypothesisStatus, patch: Partial<Hypothesis>) {
    const current = await this.readOne(id)
    if (!transitions[current.status].includes(status)) {
      throw new Error(`Invalid PenHub hypothesis transition: ${current.status} -> ${status}`)
    }
    await this.store.updateHypothesis(id, { ...patch, status, updatedAt: this.now() })
  }

  private async readOne(id: string) {
    const [hypothesis] = await this.store.listHypotheses({ id })
    if (!hypothesis) throw new Error(`PenHub hypothesis not found: ${id}`)
    return hypothesis
  }
}
