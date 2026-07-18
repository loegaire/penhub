export * as PenHubVerifier from "./verifier"

import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { Duration, Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import type { AppProcess } from "../../process"
import { statePaths } from "../state-paths"
import { PenHubRunStore } from "./store"

export function verify(
  appProcess: AppProcess.Interface,
  workspace: string,
  input: { candidate: string; claim: string; artifactPaths: readonly string[] },
  oracle?: { kind: "exact"; expectedSha256: string } | { kind: "command"; command: readonly string[] },
) {
  return Effect.gen(function* () {
    const run = yield* Effect.promise(() => PenHubRunStore.read(workspace))
    if (!run) throw new Error("PenHub run state has not been initialized")
    if (!oracle) {
      yield* Effect.promise(() => PenHubRunStore.write(workspace, { ...run, phase: "verify", noProgressTurns: 0 }))
      return {
        verified: false,
        summary: "No executable oracle is configured. The candidate remains unverified.",
      }
    }
    const result =
      oracle.kind === "exact"
        ? {
            exitCode: sha256(input.candidate) === oracle.expectedSha256 ? 0 : 1,
            output:
              sha256(input.candidate) === oracle.expectedSha256
                ? "Candidate digest matched."
                : "Candidate digest did not match.",
            method: "exact expected result",
          }
        : yield* Effect.gen(function* () {
            const [command, ...args] = oracle.command
            if (!command) throw new Error("PenHub command oracle must contain an executable")
            return yield* appProcess
              .run(
                ChildProcess.make(command, args, {
                  cwd: workspace,
                  env: { ...process.env, PENHUB_CANDIDATE: input.candidate },
                }),
                { combineOutput: true, timeout: Duration.seconds(60), maxOutputBytes: 1024 * 1024 },
              )
              .pipe(
                Effect.map((execution) => ({
                  exitCode: execution.exitCode,
                  output: execution.output?.toString("utf8") ?? "",
                  method: `command: ${oracle.command.join(" ")}`,
                })),
                Effect.catch((error) =>
                  Effect.succeed({
                    exitCode: 1,
                    output: error.message,
                    method: `command: ${oracle.command.join(" ")}`,
                  }),
                ),
              )
          })
    const artifact = path.join(statePaths(workspace).artifacts, "verifications", `verify-${randomUUID()}.log`)
    yield* Effect.promise(async () => {
      await mkdir(path.dirname(artifact), { recursive: true })
      await writeFile(artifact, result.output)
    })
    const artifactPath = path.relative(workspace, artifact)
    if (result.exitCode !== 0) {
      yield* Effect.promise(() =>
        PenHubRunStore.write(workspace, {
          ...run,
          phase: "reflect",
          lastDecisionAttemptCount: run.attemptCount + 1,
          noProgressTurns: 0,
        }),
      )
      return { verified: false, summary: "Executable oracle rejected the candidate.", artifactPath }
    }
    const verifiedAt = new Date().toISOString()
    yield* Effect.promise(() =>
      PenHubRunStore.write(workspace, {
        ...run,
        phase: "complete",
        status: "solved",
        milestoneIds: Array.from(new Set([...run.milestoneIds, "final-goal-verified"])),
        findings: [
          ...run.findings,
          {
            id: `finding_${randomUUID()}`,
            claim: input.claim,
            candidate: input.candidate,
            verificationMethod: result.method,
            artifactPaths: Array.from(new Set([...input.artifactPaths, artifactPath])),
            verifiedAt,
          },
        ],
        finalResponsePending: true,
        branches: run.branches.map((branch) =>
          branch.id === run.activeBranchId ? { ...branch, status: "supported", updatedAt: verifiedAt } : branch,
        ),
      }),
    )
    return { verified: true, summary: "Executable oracle accepted the candidate.", artifactPath }
  })
}

function sha256(value: string) {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex")
}
