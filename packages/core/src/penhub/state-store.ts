import { mkdir, readFile, writeFile } from "node:fs/promises"
import { appendJsonl, readJsonl, writeJsonl } from "./jsonl"
import { statePaths } from "./state-paths"
import {
  emptyTokenUsage,
  type Branch,
  type Challenge,
  type Evidence,
  type Fact,
  type Hypothesis,
  type StateFilter,
  type TokenUsage,
  type WorkspaceState,
} from "./types"

export interface AttackStateStore {
  initChallenge(input: Challenge): Promise<void>
  readChallenge(): Promise<Challenge>
  appendFact(fact: Fact): Promise<void>
  listFacts(filter?: StateFilter): Promise<Fact[]>
  appendHypothesis(hypothesis: Hypothesis): Promise<void>
  updateHypothesis(id: string, patch: Partial<Hypothesis>): Promise<void>
  listHypotheses(filter?: StateFilter): Promise<Hypothesis[]>
  appendBranch(branch: Branch): Promise<void>
  updateBranch(id: string, patch: Partial<Branch>): Promise<void>
  listBranches(filter?: StateFilter): Promise<Branch[]>
  appendEvidence(evidence: Evidence): Promise<void>
  listEvidence(filter?: StateFilter): Promise<Evidence[]>
  readWorkspaceState(): Promise<WorkspaceState>
}

export class FileAttackStateStore implements AttackStateStore {
  constructor(readonly workspacePath: string) {}

  async initChallenge(input: Challenge) {
    const paths = statePaths(this.workspacePath)
    await mkdir(paths.state, { recursive: true })
    await mkdir(paths.artifacts, { recursive: true })
    await mkdir(paths.tmp, { recursive: true })
    await writeFile(paths.challenge, JSON.stringify(input, null, 2) + "\n")
    await writeFile(paths.facts, "", { flag: "w" })
    await writeFile(paths.hypotheses, "", { flag: "w" })
    await writeFile(paths.branches, "", { flag: "w" })
    await writeFile(paths.evidence, "", { flag: "w" })
    await writeFile(paths.failedAttempts, "", { flag: "w" })
    await writeFile(paths.tokenUsage, JSON.stringify(emptyTokenUsage(), null, 2) + "\n")
    await writeFile(paths.report, "# PenHub Report\n\nStatus: draft\n")
  }

  async readChallenge() {
    const challenge = JSON.parse(await readFile(statePaths(this.workspacePath).challenge, "utf8")) as Partial<Challenge>
    if (!challenge.id || !challenge.name || !challenge.goal || !challenge.workspacePath || !challenge.createdAt) {
      throw new Error("PenHub challenge state is missing required fields")
    }
    return challenge as Challenge
  }

  async appendFact(fact: Fact) {
    await appendJsonl(statePaths(this.workspacePath).facts, fact)
  }

  async listFacts(filter: StateFilter = {}) {
    return applyFilter(await readJsonl<Fact>(statePaths(this.workspacePath).facts), filter)
  }

  async appendHypothesis(hypothesis: Hypothesis) {
    await appendJsonl(statePaths(this.workspacePath).hypotheses, hypothesis)
  }

  async updateHypothesis(id: string, patch: Partial<Hypothesis>) {
    const paths = statePaths(this.workspacePath)
    await writeJsonl(paths.hypotheses, updateById(await readJsonl<Hypothesis>(paths.hypotheses), id, patch))
  }

  async listHypotheses(filter: StateFilter = {}) {
    return applyFilter(await readJsonl<Hypothesis>(statePaths(this.workspacePath).hypotheses), filter)
  }

  async appendBranch(branch: Branch) {
    await appendJsonl(statePaths(this.workspacePath).branches, branch)
  }

  async updateBranch(id: string, patch: Partial<Branch>) {
    const paths = statePaths(this.workspacePath)
    await writeJsonl(paths.branches, updateById(await readJsonl<Branch>(paths.branches), id, patch))
  }

  async listBranches(filter: StateFilter = {}) {
    return applyFilter(await readJsonl<Branch>(statePaths(this.workspacePath).branches), filter)
  }

  async appendEvidence(evidence: Evidence) {
    await appendJsonl(statePaths(this.workspacePath).evidence, evidence)
  }

  async listEvidence(filter: StateFilter = {}) {
    return applyFilter(await readJsonl<Evidence>(statePaths(this.workspacePath).evidence), filter)
  }

  async readWorkspaceState() {
    const paths = statePaths(this.workspacePath)
    return {
      challenge: await this.readChallenge(),
      facts: await this.listFacts(),
      hypotheses: await this.listHypotheses(),
      branches: await this.listBranches(),
      evidence: await this.listEvidence(),
      tokenUsage: await readTokenUsage(paths.tokenUsage),
    }
  }
}

export async function writeTokenUsage(workspacePath: string, usage: TokenUsage) {
  await writeFile(statePaths(workspacePath).tokenUsage, JSON.stringify(usage, null, 2) + "\n")
}

async function readTokenUsage(file: string): Promise<TokenUsage> {
  try {
    return { ...emptyTokenUsage(), ...(JSON.parse(await readFile(file, "utf8")) as Partial<TokenUsage>) }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyTokenUsage()
    throw error
  }
}

function updateById<T extends { id: string }>(items: T[], id: string, patch: Partial<T>) {
  let found = false
  const next = items.map((item) => {
    if (item.id !== id) return item
    found = true
    return { ...item, ...patch }
  })
  if (!found) throw new Error(`PenHub state item not found: ${id}`)
  return next
}

function applyFilter<T extends { id?: unknown; status?: unknown; branchId?: unknown; hypothesisId?: unknown; evidenceIds?: unknown }>(
  items: T[],
  filter: StateFilter,
) {
  const statuses = Array.isArray(filter.status) ? filter.status : filter.status ? [filter.status] : undefined
  const output = items.filter((item) => {
    if (filter.id && item.id !== filter.id) return false
    if (filter.branchId && item.branchId !== filter.branchId) return false
    if (filter.hypothesisId && item.hypothesisId !== filter.hypothesisId) return false
    if (statuses && !statuses.includes(String(item.status))) return false
    if (filter.evidenceId) {
      const evidenceIds = Array.isArray(item.evidenceIds) ? item.evidenceIds : []
      if (!evidenceIds.includes(filter.evidenceId)) return false
    }
    return true
  })
  return typeof filter.limit === "number" ? output.slice(0, Math.max(0, filter.limit)) : output
}
