import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { parseBenchmarkCaseManifest, resolveCasePaths } from "../metrics/manifest"
import type { BenchmarkRunResult } from "../metrics/schema"
import { digest, parseCliEvents, summarizeCliEvents } from "../metrics/trace"

const options = parseArgs(Bun.argv.slice(2))
const manifest = parseBenchmarkCaseManifest(await Bun.file(options.casePath).json())
const paths = resolveCasePaths(options.casePath, manifest)
const prompt = await Bun.file(paths.prompt).text()
const harnessRevision = revision(process.cwd())
const caseRevision = digest(JSON.stringify(await inventory(paths.root)))
if (options.trials > manifest.maxAttempts) {
  throw new Error(`Requested ${options.trials} trials, but this case allows at most ${manifest.maxAttempts}`)
}

await mkdir(options.output, { recursive: true })
for (const trial of Array.from({ length: options.trials }, (_, index) => index + 1)) await runTrial(trial)

async function runTrial(trial: number) {
  const trialDir = path.join(options.output, options.runner, `trial-${trial}`)
  const temporary = await mkdtemp(path.join(os.tmpdir(), "penhub-eval-"))
  const workspace = path.join(temporary, "workspace")
  try {
    await mkdir(path.dirname(trialDir), { recursive: true })
    await mkdir(trialDir)
    await mkdir(path.join(temporary, "config"), { recursive: true })
    await cp(paths.workspace, workspace, { recursive: true })
    const command = [
      process.execPath,
      "run",
      "packages/opencode/src/index.ts",
      "run",
      "--pure",
      "--format",
      "json",
      "--model",
      options.model,
      ...(options.variant ? ["--variant", options.variant] : []),
      "--dir",
      workspace,
      "--dangerously-skip-permissions",
      prompt,
    ]

    if (manifest.setup) {
      const setup = await runCommand(
        manifest.setup,
        paths.root,
        { PENHUB_WORKSPACE: workspace },
        manifest.wallTimeSeconds * 1_000,
      )
      if (setup.exitCode !== 0 || setup.timedOut) {
        throw new Error(`Benchmark setup failed (exit ${setup.exitCode}): ${setup.stderr.trim()}`)
      }
    }
    const initialFiles = await inventory(workspace)
    const startedAt = new Date().toISOString()
    const execution = await runCommand(
      command,
      process.cwd(),
      {
        OPENCODE_DISABLE_SNAPSHOTS: "1",
        OPENCODE_CONFIG_DIR: path.join(temporary, "config"),
        PENHUB_BENCHMARK_BASELINE: options.runner === "opencode-baseline" ? "1" : "0",
        ...(manifest.outputTokenLimit === undefined
          ? {}
          : { OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX: String(manifest.outputTokenLimit) }),
      },
      manifest.wallTimeSeconds * 1_000,
    )
    const finishedAt = new Date().toISOString()
    const events = parseCliEvents(execution.stdout)
    const summary = summarizeCliEvents(events, manifest.resultPattern)
    const candidate = summary.candidate
    const oracle = await runCommand(
      manifest.oracle,
      paths.root,
      { PENHUB_CANDIDATE: candidate ?? "", PENHUB_WORKSPACE: workspace },
      30_000,
    )
    const replayWorkspace = path.join(temporary, "replay")
    await cp(paths.workspace, replayWorkspace, { recursive: true })
    const replay = await runCommand(
      manifest.oracle,
      paths.root,
      { PENHUB_CANDIDATE: candidate ?? "", PENHUB_WORKSPACE: replayWorkspace },
      30_000,
    )
    const completedMilestones = manifest.milestones
      .filter((milestone) => {
        if (milestone.kind === "tool-call") {
          return summary.toolCalls.some((tool) => milestone.tool === undefined || tool.tool === milestone.tool)
        }
        if (milestone.kind === "transcript-pattern") return new RegExp(milestone.pattern ?? "").test(execution.stdout)
        if (milestone.kind === "candidate") return candidate !== undefined
        return oracle.exitCode === 0
      })
      .map((milestone) => milestone.id)
    const artifacts = (await inventory(workspace)).filter((item) => item.path.startsWith(".penhub/artifacts/"))
    const tracePath = path.relative(process.cwd(), path.join(trialDir, "events.jsonl"))
    const result = {
      runner: options.runner,
      caseId: manifest.id,
      model: options.model,
      ...(options.variant ? { modelVariant: options.variant } : {}),
      startedAt,
      finishedAt,
      success: oracle.exitCode === 0,
      flagFound: candidate !== undefined,
      ...(candidate === undefined ? {} : { flag: candidate }),
      ...(candidate === undefined
        ? {}
        : {
            timeToFlagSeconds: Math.max(
              0,
              Math.round(((summary.candidateTimestamp ?? Date.parse(finishedAt)) - Date.parse(startedAt)) / 1_000),
            ),
          }),
      totalTokens: summary.tokens.input + summary.tokens.output + summary.tokens.reasoning,
      toolCallsCount: summary.toolCalls.length,
      repeatedActionsCount: summary.fingerprints.length - new Set(summary.fingerprints).size,
      humanInterventionsCount: 0,
      evidenceItemsCount: artifacts.length,
      reportGenerated: false,
      reportReplayabilityScore: replay.exitCode === 0 ? 1 : 0,
      notes: [
        "Controlled local run; not sample data.",
        `CLI exit ${execution.exitCode}; oracle exit ${oracle.exitCode}; replay oracle exit ${replay.exitCode}.`,
      ],
      isSampleData: false,
      trial,
      harnessRevision,
      caseRevision,
      sessionId: summary.sessionID,
      oraclePassed: oracle.exitCode === 0,
      replaySuccess: replay.exitCode === 0,
      highestMilestone: completedMilestones.at(-1),
      milestones: completedMilestones,
      inputTokens: summary.tokens.input,
      outputTokens: summary.tokens.output,
      reasoningTokens: summary.tokens.reasoning,
      toolErrorsCount: summary.toolErrors,
      actionFingerprints: summary.fingerprints,
      artifactPaths: artifacts.map((item) => item.path),
      tracePath,
      exitCode: execution.exitCode,
      timedOut: execution.timedOut,
      observations: {
        eventCount: events.length,
        eventTypes: events.map((event) => event.type),
        toolSequence: summary.toolCalls.map((item) => item.tool),
        toolOutcomes: summary.toolCalls.map((item) => item.status),
        finishReasons: summary.finishReasons,
        assistantTextSha256: digest(summary.text),
        stdoutBytes: Buffer.byteLength(execution.stdout),
        stderrBytes: Buffer.byteLength(execution.stderr),
        stderrSha256: digest(execution.stderr),
        initialWorkspaceFiles: initialFiles.length,
        finalWorkspaceFiles: (await inventory(workspace)).length,
        oracleStdout: oracle.stdout.trim(),
        oracleStderr: oracle.stderr.trim(),
        replayOracleStdout: replay.stdout.trim(),
        replayOracleStderr: replay.stderr.trim(),
      },
    } satisfies BenchmarkRunResult

    await writeFile(path.join(trialDir, "events.jsonl"), execution.stdout)
    await writeFile(path.join(trialDir, "stderr.log"), execution.stderr)
    await writeFile(path.join(trialDir, "assistant.md"), summary.text)
    await writeFile(path.join(trialDir, "result.json"), JSON.stringify(result, null, 2) + "\n")
    await writeFile(
      path.join(trialDir, "workspace-files.json"),
      JSON.stringify(await inventory(workspace), null, 2) + "\n",
    )
    if (artifacts.length)
      await cp(path.join(workspace, ".penhub", "artifacts"), path.join(trialDir, "artifacts"), { recursive: true })
    console.log(
      `${options.runner} trial ${trial}: ${result.success ? "pass" : "fail"} (${result.toolCallsCount} tools)`,
    )
  } finally {
    try {
      if (manifest.teardown) {
        await runCommand(manifest.teardown, paths.root, { PENHUB_WORKSPACE: workspace }, 30_000)
      }
    } finally {
      await rm(temporary, { recursive: true, force: true })
    }
  }
}

function parseArgs(args: string[]) {
  const values = new Map<string, string>()
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]
    if (!key?.startsWith("--") || !value) throw new Error("Expected --case, --runner, --model, --output, and --trials")
    values.set(key.slice(2), value)
  }
  const runner = values.get("runner")
  if (runner !== "opencode-baseline" && runner !== "penhub")
    throw new Error("Runner must be opencode-baseline or penhub")
  const casePath = values.get("case")
  const model = values.get("model")
  const output = values.get("output")
  if (!casePath || !model || !output) throw new Error("Expected --case, --runner, --model, and --output")
  const trials = Number(values.get("trials") ?? "1")
  if (!Number.isInteger(trials) || trials <= 0) throw new Error("Trials must be a positive integer")
  return {
    runner,
    casePath: path.resolve(casePath),
    model,
    output: path.resolve(output),
    trials,
    variant: values.get("variant"),
  }
}

async function runCommand(command: string[], cwd: string, env: Record<string, string>, timeout: number) {
  const child = Bun.spawn(command, {
    cwd,
    env: { ...Bun.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  })
  const output = Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()])
  const state = { timedOut: false, forceKill: undefined as ReturnType<typeof setTimeout> | undefined }
  const timeoutID = setTimeout(() => {
    state.timedOut = true
    child.kill("SIGTERM")
    state.forceKill = setTimeout(() => child.kill("SIGKILL"), 2_000)
  }, timeout)
  const exitCode = await child.exited
  clearTimeout(timeoutID)
  if (state.forceKill) clearTimeout(state.forceKill)
  const [stdout, stderr] = await output
  return { stdout, stderr, exitCode, timedOut: state.timedOut }
}

async function inventory(root: string) {
  const files = (await readdir(root, { recursive: true })).toSorted()
  return (
    await Promise.all(
      files.map(async (file) => {
        const absolute = path.join(root, file)
        const info = await stat(absolute)
        if (!info.isFile()) return undefined
        return { path: file, bytes: info.size, sha256: digest(await readFile(absolute)) }
      }),
    )
  ).filter((item): item is { path: string; bytes: number; sha256: string } => item !== undefined)
}

function revision(root: string) {
  const result = Bun.spawnSync(["git", "-C", root, "rev-parse", "HEAD"])
  if (result.exitCode !== 0) return "unversioned"
  return result.stdout.toString().trim()
}
