# PenHub

PenHub is an OpenCode-derived security agent for CTF work, authorized auditing, reverse engineering, cryptanalysis, and digital forensics. It keeps OpenCode's durable Session V2 runtime while replacing the generic coding workflow with security agents, packaged tools, evidence state, and a live browser cockpit.

## Product Surfaces

- **Web GUI:** real sessions, prompts, model-exposed reasoning, tool calls, shell output, attack branches, hypotheses, evidence, failures, reports, and tool-pack status.
- **TUI:** the retained terminal workflow, reduced to security-focused agents and session controls.
- **CLI:** only the TUI launcher, API access, background service, server, and OCI tool-pack management.

## Architecture

```text
Web GUI / TUI / CLI
        |
Generated Client -> Protocol HttpApi -> Server
                                      |
                              Session V2 runner
                                      |
             operator / recon / source-audit / binary / forensics / crypto
                                      |
                    canonical PenHub tools + permissions
                                      |
              Docker or Podman OCI security tool packs
                                      |
               .penhub/artifacts + compact state card
```

The model loop remains Session V2. PenHub does not add another orchestrator, database, queue, or external model service. Raw command output is retained in `.penhub/artifacts`; only compact previews and state cards enter model context.

## Security Tool Packs

PenHub registers 54 tools from six versioned OCI images:

| Pack        | Coverage                                                            |
| ----------- | ------------------------------------------------------------------- |
| `web`       | HTTP/DNS discovery, crawling, fuzzing, scanning, SQL injection, TLS |
| `browser`   | Playwright and Chromium automation                                  |
| `audit`     | source, secret, dependency, Python, and shell auditing              |
| `binary`    | debugging, disassembly, ROP, ELF, Android, exploit scripting        |
| `forensics` | PCAP, disk, firmware, metadata, PDF, carving, steganography         |
| `crypto`    | SageMath, Z3, PARI/GP, Python crypto, hashes, passwords             |

The runtime never resolves these security binaries from the host `PATH`. It runs the selected command in its pack image with the active workspace mounted at `/workspace`.

## Run Locally

Install dependencies:

```bash
bun install
```

Start the V2 API:

```bash
OPENCODE_SERVER_PASSWORD= bun run packages/cli/src/index.ts serve --port 4096
```

Start the Web GUI in another terminal:

```bash
bun run dev:gui
```

Open `http://localhost:3000/penhub.html`. Pass a different API URL with `?server=http://host:port`.

Start the TUI:

```bash
bun run dev
```

List or preload tool packs:

```bash
bun run packages/cli/src/index.ts tools list
bun run packages/cli/src/index.ts tools preload
```

## Build Tool Packs

Dockerfiles and the multi-platform Bake definition live in `toolpacks/`.

```bash
cd toolpacks
docker buildx bake --set '*.platform=linux/amd64' --load
```

Release builds should be pushed, then `bun run script/lock.ts` should populate `images.lock.json` with registry digests.

## Durable State

```text
.penhub/
  state/
    challenge.json
    facts.jsonl
    hypotheses.jsonl
    branches.jsonl
    evidence.jsonl
    failed_attempts.jsonl
    token_usage.json
    report.md
  artifacts/
    tool-runs/
  tmp/
```

## Validation

Run tests and type checks from package directories, never from the repository root.

```bash
cd packages/core
bun test test/penhub/toolpack.test.ts test/agent.test.ts
bun typecheck
```

```bash
cd packages/app
bun typecheck
bun run build
```

## Upstream Attribution

PenHub extends OpenCode's package layout, Session runtime, provider integrations, Client, TUI, and App foundations. OpenCode is maintained at <https://github.com/anomalyco/opencode>.
