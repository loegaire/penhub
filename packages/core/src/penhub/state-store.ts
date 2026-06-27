import { mkdir, readFile, writeFile } from "node:fs/promises"
import { appendJsonl, readJsonl, writeJsonl } from "./jsonl"
import { statePaths } from "./state-paths"
import {
  emptyTokenUsage,
  type Branch,
  type Challenge,
  type Evidence,
  type Fact,
  type FailedAttempt,
  type Hypothesis,
  type StateFilter,
  type TokenUsage,
  type WorkspaceState,
} from "./types"
import {
  assertBranch,
  assertChallenge,
  assertEvidence,
  assertFact,
  assertFailedAttempt,
  assertHypothesis,
  assertTokenUsage,
  normalizeTokenUsage,
} from "./validation"

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
  appendFailedAttempt(attempt: FailedAttempt): Promise<void>
  listFailedAttempts(filter?: StateFilter): Promise<FailedAttempt[]>
  readWorkspaceState(): Promise<WorkspaceState>
}

export class FileAttackStateStore implements AttackStateStore {
  constructor(readonly workspacePath: string) {}

  async initChallenge(input: Challenge) {
    assertChallenge(input)
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
    const file = statePaths(this.workspacePath).challenge
    let challenge: unknown
    try {
      challenge = JSON.parse(await readFile(file, "utf8"))
    } catch (error) {
      if (errorCode(error) === "ENOENT") {
        throw new Error(`PenHub challenge state is missing: ${file}`, { cause: error })
      }
      throw new Error(`Invalid PenHub challenge JSON at ${file}: ${errorDetail(error)}`, { cause: error })
    }
    assertChallenge(challenge)
    return challenge
  }

  async appendFact(fact: Fact) {
    assertFact(fact)
    await appendJsonl(statePaths(this.workspacePath).facts, fact)
  }

  async listFacts(filter: StateFilter = {}) {
    return applyFilter(
      await readValidatedJsonl(statePaths(this.workspacePath).facts, assertFact, "PenHub fact"),
      filter,
    )
  }

  async appendHypothesis(hypothesis: Hypothesis) {
    assertHypothesis(hypothesis)
    await appendJsonl(statePaths(this.workspacePath).hypotheses, hypothesis)
  }

  async updateHypothesis(id: string, patch: Partial<Hypothesis>) {
    const paths = statePaths(this.workspacePath)
    const next = updateById(
      await readValidatedJsonl(paths.hypotheses, assertHypothesis, "PenHub hypothesis"),
      id,
      patch,
    )
    next.forEach(assertHypothesis)
    await writeJsonl(paths.hypotheses, next)
  }

  async listHypotheses(filter: StateFilter = {}) {
    return applyFilter(
      await readValidatedJsonl(statePaths(this.workspacePath).hypotheses, assertHypothesis, "PenHub hypothesis"),
      filter,
    )
  }

  async appendBranch(branch: Branch) {
    assertBranch(branch)
    await appendJsonl(statePaths(this.workspacePath).branches, branch)
  }

  async updateBranch(id: string, patch: Partial<Branch>) {
    const paths = statePaths(this.workspacePath)
    const next = updateById(await readValidatedJsonl(paths.branches, assertBranch, "PenHub branch"), id, patch)
    next.forEach(assertBranch)
    await writeJsonl(paths.branches, next)
  }

  async listBranches(filter: StateFilter = {}) {
    return applyFilter(
      await readValidatedJsonl(statePaths(this.workspacePath).branches, assertBranch, "PenHub branch"),
      filter,
    )
  }

  async appendEvidence(evidence: Evidence) {
    assertEvidence(evidence)
    await appendJsonl(statePaths(this.workspacePath).evidence, evidence)
  }

  async listEvidence(filter: StateFilter = {}) {
    return applyFilter(
      await readValidatedJsonl(statePaths(this.workspacePath).evidence, assertEvidence, "PenHub evidence"),
      filter,
    )
  }

  async appendFailedAttempt(attempt: FailedAttempt) {
    assertFailedAttempt(attempt)
    await appendJsonl(statePaths(this.workspacePath).failedAttempts, attempt)
  }

  async listFailedAttempts(filter: StateFilter = {}) {
    return applyFilter(
      await readValidatedJsonl(
        statePaths(this.workspacePath).failedAttempts,
        assertFailedAttempt,
        "PenHub failed attempt",
      ),
      filter,
    )
  }

  async readWorkspaceState() {
    const paths = statePaths(this.workspacePath)
    return {
      challenge: await this.readChallenge(),
      facts: await this.listFacts(),
      hypotheses: await this.listHypotheses(),
      branches: await this.listBranches(),
      evidence: await this.listEvidence(),
      failedAttempts: await this.listFailedAttempts(),
      tokenUsage: await readTokenUsage(paths.tokenUsage),
    }
  }
}

export async function writeTokenUsage(workspacePath: string, usage: TokenUsage) {
  assertTokenUsage(usage)
  await writeFile(statePaths(workspacePath).tokenUsage, JSON.stringify(usage, null, 2) + "\n")
}

async function readTokenUsage(file: string): Promise<TokenUsage> {
  try {
    return normalizeTokenUsage(JSON.parse(await readFile(file, "utf8")))
  } catch (error) {
    if (errorCode(error) === "ENOENT") return emptyTokenUsage()
    throw error
  }
}

async function readValidatedJsonl<T>(
  file: string,
  assertRecord: (record: unknown) => asserts record is T,
  entity: string,
): Promise<T[]> {
  const records = await readJsonl(file)
  return records.map((record, index) => {
    try {
      assertRecord(record)
      return record
    } catch (error) {
      throw new Error(`Invalid ${entity} record at ${file}:${index + 1}: ${errorDetail(error)}`, { cause: error })
    }
  })
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

function applyFilter<
  T extends {
    id?: unknown
    status?: unknown
    branchId?: unknown
    hypothesisId?: unknown
    actionId?: unknown
    evidenceIds?: unknown
  },
>(items: T[], filter: StateFilter) {
  const statuses = Array.isArray(filter.status) ? filter.status : filter.status ? [filter.status] : undefined
  const output = items.filter((item) => {
    if (filter.id && item.id !== filter.id) return false
    if (filter.branchId && item.branchId !== filter.branchId) return false
    if (filter.hypothesisId && item.hypothesisId !== filter.hypothesisId) return false
    if (filter.actionId && item.actionId !== filter.actionId) return false
    if (statuses && !statuses.includes(String(item.status))) return false
    if (filter.evidenceId) {
      const evidenceIds = Array.isArray(item.evidenceIds) ? item.evidenceIds : []
      if (!evidenceIds.includes(filter.evidenceId)) return false
    }
    return true
  })
  return typeof filter.limit === "number" ? output.slice(0, Math.max(0, filter.limit)) : output
}

function errorDetail(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function errorCode(error: unknown) {
  return error && typeof error === "object" ? Reflect.get(error, "code") : undefined
}
