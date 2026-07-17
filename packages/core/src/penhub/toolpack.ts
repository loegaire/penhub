export * as PenHubToolpack from "./toolpack"

import path from "node:path"
import { mkdir, writeFile } from "node:fs/promises"
import { PenHub } from "@opencode-ai/schema/penhub"
import { Duration, Effect, Option, Schema } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { AppProcess } from "../process"
import { statePaths } from "./state-paths"

export type Definition = {
  readonly pack: PenHub.ToolPackID
  readonly name: string
  readonly command: string
  readonly description: string
}

type Pack = {
  readonly id: PenHub.ToolPackID
  readonly description: string
  readonly image: string
  readonly digest?: string
  readonly platforms: readonly ("linux/amd64" | "linux/arm64")[]
  readonly tools: readonly Definition[]
}

export const catalog: readonly Pack[] = [
  pack("web", "Web discovery, probing, fuzzing, and TLS inspection", [
    tool("sec_httpx", "httpx", "Probe HTTP services and emit structured response metadata."),
    tool("sec_ffuf", "ffuf", "Fuzz paths, parameters, headers, and virtual hosts."),
    tool("sec_nuclei", "nuclei", "Run template-driven vulnerability checks."),
    tool("sec_katana", "katana", "Crawl web applications and extract endpoints."),
    tool("sec_subfinder", "subfinder", "Enumerate passive subdomains."),
    tool("sec_naabu", "naabu", "Discover listening TCP ports."),
    tool("sec_nmap", "nmap", "Map hosts, services, versions, and common network exposure."),
    tool("sec_dnsx", "dnsx", "Resolve and validate DNS records at scale."),
    tool("sec_dig", "dig", "Inspect precise DNS records and resolver behavior."),
    tool("sec_gobuster", "gobuster", "Enumerate web paths, virtual hosts, and DNS names."),
    tool("sec_nikto", "nikto", "Check web servers for known insecure files and configuration."),
    tool("sec_sqlmap", "sqlmap", "Test and reproduce SQL injection with explicit arguments."),
    tool("sec_curl", "curl", "Send precise HTTP requests and preserve raw responses."),
    tool("sec_openssl", "openssl", "Inspect TLS endpoints, certificates, and cryptographic material."),
  ]),
  pack("browser", "Browser automation and client-side inspection", [
    tool("sec_playwright", "playwright", "Automate a real browser for authenticated and JavaScript-heavy flows."),
    tool("sec_chromium", "chromium", "Run Chromium directly for browser security reproduction."),
  ]),
  pack("audit", "Source and dependency security auditing", [
    tool("sec_semgrep", "semgrep", "Run semantic static-analysis rules over source code."),
    tool("sec_gitleaks", "gitleaks", "Detect credentials and secrets in files and Git history."),
    tool("sec_trivy", "trivy", "Scan source trees, filesystems, images, and dependency manifests."),
    tool("sec_osv_scanner", "osv-scanner", "Match dependency manifests against OSV advisories."),
    tool("sec_bandit", "bandit", "Audit Python source for common security weaknesses."),
    tool("sec_shellcheck", "shellcheck", "Detect correctness and security hazards in shell scripts."),
    tool("sec_ripgrep", "rg", "Search large source trees using regular expressions."),
  ]),
  pack("binary", "Reverse engineering and binary exploitation", [
    tool("sec_gdb", "gdb", "Debug native binaries in batch or interactive command mode."),
    tool("sec_radare2", "r2", "Inspect and analyze native binaries."),
    tool("sec_ropgadget", "ROPgadget", "Enumerate ROP and JOP gadgets."),
    tool("sec_objdump", "objdump", "Disassemble binaries and inspect sections."),
    tool("sec_readelf", "readelf", "Inspect ELF metadata, symbols, and relocations."),
    tool("sec_strings", "strings", "Extract printable strings from binary artifacts."),
    tool("sec_patchelf", "patchelf", "Inspect or modify ELF interpreter and dynamic dependencies."),
    tool("sec_checksec", "checksec", "Summarize exploit mitigations for binaries and processes."),
    tool("sec_nasm", "nasm", "Assemble x86 and x86-64 payloads or test snippets."),
    tool("sec_pwntools", "python", "Run Python exploit scripts with pwntools available."),
    tool("sec_jadx", "jadx", "Decompile Android APK and DEX artifacts."),
  ]),
  pack("forensics", "Network, file, firmware, and document forensics", [
    tool("sec_tshark", "tshark", "Decode and filter packet captures."),
    tool("sec_tcpdump", "tcpdump", "Inspect packet captures with BPF filters."),
    tool("sec_binwalk", "binwalk", "Identify and extract embedded firmware content."),
    tool("sec_exiftool", "exiftool", "Inspect and edit file metadata."),
    tool("sec_yara", "yara", "Match files against YARA rules."),
    tool("sec_pdfinfo", "pdfinfo", "Inspect PDF structure and metadata."),
    tool("sec_pdftotext", "pdftotext", "Extract searchable text from PDF documents."),
    tool("sec_fls", "fls", "List allocated and deleted files in disk images with Sleuth Kit."),
    tool("sec_foremost", "foremost", "Carve files from disk images by content signatures."),
    tool("sec_steghide", "steghide", "Inspect and extract steganographic payloads from supported media."),
    tool("sec_pngcheck", "pngcheck", "Validate and inspect PNG chunk structure."),
    tool("sec_file", "file", "Identify artifact formats from content signatures."),
  ]),
  pack("crypto", "Cryptanalysis, constraints, and password recovery", [
    tool("sec_python_crypto", "python", "Run Python with PyCryptodome, SymPy, and Z3 available."),
    tool("sec_sage", "sage", "Run SageMath scripts for algebraic cryptanalysis."),
    tool("sec_z3", "z3", "Solve SMT constraints from files or standard input."),
    tool("sec_gp", "gp", "Run PARI/GP number-theory programs."),
    tool("sec_john", "john", "Run John the Ripper against supplied challenge material."),
    tool("sec_hashcat", "hashcat", "Run Hashcat against supplied challenge material."),
    tool("sec_openssl_crypto", "openssl", "Inspect and transform standard cryptographic formats."),
    tool("sec_xxd", "xxd", "Inspect and transform binary data as hexadecimal."),
  ]),
]

export const Runtime = Schema.Literals(["docker", "podman"])
export type Runtime = typeof Runtime.Type

export const RunInput = Schema.Struct({
  args: Schema.Array(Schema.String).annotate({ description: "Arguments passed directly to the packaged tool." }),
  stdin: Schema.String.pipe(Schema.optional).annotate({ description: "Optional standard input for the tool." }),
  timeout: Schema.Number.pipe(Schema.optional).annotate({ description: "Timeout in milliseconds." }),
})

export const RunOutput = Schema.Struct({
  tool: Schema.String,
  pack: PenHub.ToolPackID,
  runtime: Runtime,
  image: Schema.String,
  exit: Schema.Number,
  preview: Schema.String,
  artifactPath: Schema.String,
  truncated: Schema.Boolean,
})

export function list(appProcess: AppProcess.Interface) {
  return Effect.gen(function* () {
    const runtime = yield* detectRuntime(appProcess).pipe(Effect.option)
    return yield* Effect.forEach(catalog, (item) =>
      isInstalled(appProcess, Option.getOrUndefined(runtime), imageReference(item)).pipe(
        Effect.map((installed): PenHub.ToolPackInfo => ({ ...item, installed })),
      ),
    )
  })
}

export function pull(appProcess: AppProcess.Interface, id: PenHub.ToolPackID) {
  const item = requirePack(id)
  return Effect.gen(function* () {
    const runtime = yield* detectRuntime(appProcess)
    const result = yield* pullImage(appProcess, runtime, item)
    return {
      pack: item.id,
      runtime,
      image: imageReference(item),
      output: result.output?.toString("utf8") || "Image is ready.",
    } satisfies PenHub.PullResult
  })
}

export function run(
  appProcess: AppProcess.Interface,
  workspace: string,
  definition: Definition,
  input: typeof RunInput.Type,
) {
  const item = requirePack(definition.pack)
  return Effect.gen(function* () {
    const runtime = yield* detectRuntime(appProcess)
    const installed = yield* isInstalled(appProcess, runtime, imageReference(item))
    if (!installed) yield* pullImage(appProcess, runtime, item)
    const command = buildRunCommand({
      runtime,
      image: imageReference(item),
      workspace,
      command: definition.command,
      args: input.args,
    })
    const result = yield* appProcess.run(ChildProcess.make(command.command, command.args, { stdin: "pipe" }), {
      combineOutput: true,
      stdin: input.stdin,
      timeout: Duration.millis(input.timeout ?? 10 * 60 * 1_000),
      maxOutputBytes: 16 * 1024 * 1024,
    })
    const raw = result.output?.toString("utf8") || ""
    const artifactPath = path.join(
      statePaths(workspace).artifacts,
      "tool-runs",
      `${new Date().toISOString().replaceAll(":", "-")}-${definition.name}.log`,
    )
    yield* Effect.promise(async () => {
      await mkdir(path.dirname(artifactPath), { recursive: true })
      await writeFile(artifactPath, raw)
    })
    return {
      tool: definition.name,
      pack: definition.pack,
      runtime,
      image: imageReference(item),
      exit: result.exitCode,
      preview: preview(raw),
      artifactPath: path.relative(workspace, artifactPath),
      truncated: result.outputTruncated === true || raw.length > 12_000,
    }
  })
}

export function buildRunCommand(input: {
  runtime: Runtime
  image: string
  workspace: string
  command: string
  args: readonly string[]
}) {
  const network = process.platform === "linux" ? ["--network", "host"] : []
  const user =
    process.platform === "linux" && process.getuid && process.getgid
      ? ["--user", `${process.getuid()}:${process.getgid()}`]
      : []
  return {
    command: input.runtime,
    args: [
      "run",
      "--rm",
      "--init",
      ...network,
      ...user,
      "-v",
      `${input.workspace}:/workspace`,
      "-w",
      "/workspace",
      input.image,
      input.command,
      ...input.args,
    ],
  }
}

export function requirePack(id: PenHub.ToolPackID) {
  const item = catalog.find((candidate) => candidate.id === id)
  if (!item) throw new Error(`Unknown PenHub tool pack: ${id}`)
  return item
}

function pack(id: PenHub.ToolPackID, description: string, tools: readonly Omit<Definition, "pack">[]): Pack {
  const image = `ghcr.io/penhub-ai/toolpack-${id}:0.1.0`
  return {
    id,
    description,
    image,
    platforms: ["linux/amd64", "linux/arm64"],
    tools: tools.map((item) => ({ ...item, pack: id })),
  }
}

function tool(name: string, command: string, description: string): Omit<Definition, "pack"> {
  return { name, command, description }
}

function imageReference(item: Pack) {
  return item.digest ? `${item.image}@${item.digest}` : item.image
}

function detectRuntime(appProcess: AppProcess.Interface) {
  return Effect.findFirst(["docker", "podman"] as const, (runtime) =>
    appProcess
      .run(ChildProcess.make(runtime, ["version"]), { timeout: Duration.seconds(10), maxErrorBytes: 8_192 })
      .pipe(
        Effect.map((result) => result.exitCode === 0),
        Effect.catch(() => Effect.succeed(false)),
      ),
  ).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(new Error("PenHub requires Docker or Podman to run packaged security tools.")),
        onSome: Effect.succeed,
      }),
    ),
  )
}

function isInstalled(appProcess: AppProcess.Interface, runtime: Runtime | undefined, image: string) {
  if (!runtime) return Effect.succeed(false)
  return appProcess
    .run(ChildProcess.make(runtime, ["image", "inspect", image]), { timeout: Duration.seconds(10) })
    .pipe(
      Effect.map((result) => result.exitCode === 0),
      Effect.catch(() => Effect.succeed(false)),
    )
}

function pullImage(appProcess: AppProcess.Interface, runtime: Runtime, item: Pack) {
  return appProcess
    .run(ChildProcess.make(runtime, ["pull", imageReference(item)]), {
      combineOutput: true,
      timeout: Duration.minutes(30),
      maxOutputBytes: 1024 * 1024,
    })
    .pipe(Effect.flatMap(AppProcess.requireSuccess))
}

function preview(output: string) {
  if (output.length <= 12_000) return output || "(no output)"
  return `${output.slice(0, 8_000)}\n\n[raw output retained in artifact]\n\n${output.slice(-4_000)}`
}
