# PenHub

PenHub is an OpenCode-derived security agent for CTF work, authorized security auditing, reverse engineering, cryptanalysis, and digital forensics. It keeps OpenCode's durable Session V2 runtime and adds security-focused agents, packaged OCI tools, evidence state, and a live browser cockpit.

> Use PenHub only on systems and challenges you own or are explicitly authorized to test.

## What You Can Run

PenHub currently runs from a source checkout. A clone provides three main surfaces:

- **TUI:** the quickest way to start PenHub. It launches or reuses a local background API automatically.
- **Web GUI:** a browser cockpit backed by the same API. The API and frontend run as separate local processes.
- **CLI/API:** commands for the background service, direct API access, a standalone server, and OCI tool-pack management.

The runtime can use six OCI security tool packs containing 54 tools:

| Pack        | Coverage                                                                |
| ----------- | ----------------------------------------------------------------------- |
| `web`       | HTTP/DNS discovery, crawling, fuzzing, scanning, SQL injection, and TLS |
| `browser`   | Playwright and Chromium automation                                      |
| `audit`     | Source, secret, dependency, Python, and shell auditing                  |
| `binary`    | Debugging, disassembly, ROP, ELF, Android, and exploit scripting        |
| `forensics` | PCAP, disk, firmware, metadata, PDF, carving, and steganography         |
| `crypto`    | SageMath, Z3, PARI/GP, Python crypto, hashes, and passwords             |

## Requirements

Required for the core application:

- Git
- [Bun](https://bun.sh/) 1.3.14 or a compatible 1.3.x release
- A model-provider account and API key, unless an already connected provider is available

Required only for packaged security tools:

- Docker or Podman
- Docker Buildx if the tool-pack images need to be built locally

Linux is the intended tool-pack environment. On Windows, WSL2 is the least-friction way to run the repository and mount Linux workspaces into the tool containers.

Confirm Bun before installing:

```bash
bun --version
```

## Clone and Install

The default branch is `master`:

```bash
git clone https://github.com/loegaire/penhub.git
cd penhub
bun install
```

`bun install` installs all workspace dependencies and runs the repository's post-install setup for the terminal runtime.

## Quick Start: Terminal UI

From the repository root:

```bash
bun run dev
```

This starts the PenHub TUI. It also starts a password-protected local background API when one is not already running. The generated password and server registration stay in the local application state directory; they do not need to be entered manually by the TUI.

On first launch:

1. Open **Connect provider**, or enter `/connect`.
2. Select a provider and complete its API-key or authorization flow.
3. Enter `/models` to select the model used for new sessions.
4. Open a workspace and start a session.

Useful service commands:

```bash
# Show whether the background API is running
bun run packages/cli/src/index.ts service status

# Start or restart it explicitly
bun run packages/cli/src/index.ts service start
bun run packages/cli/src/index.ts service restart

# Stop it
bun run packages/cli/src/index.ts service stop
```

## Quick Start: Web GUI

The development Web GUI needs an API server and the Vite frontend. Run them in separate terminals.

### Terminal 1: start the local API

```bash
cd penhub
OPENCODE_SERVER_PASSWORD= bun run packages/cli/src/index.ts serve --port 4096
```

The empty password is intentional for this loopback-only development setup. The server binds to `127.0.0.1` by default, so it is not exposed to the network.

Expected output:

```text
server listening on http://127.0.0.1:4096
```

### Terminal 2: start the frontend

```bash
cd penhub
bun run dev:gui
```

Open:

```text
http://localhost:3000/penhub.html
```

The browser cockpit defaults to `http://localhost:4096`. To select another API or workspace, use query parameters:

```text
http://localhost:3000/penhub.html?server=http://localhost:4097&workspace=/absolute/path/to/workspace
```

URL-encode the workspace value when it contains spaces or special characters.

### Connect a provider in the Web GUI

1. Open the **Provider** panel in the top runtime controls.
2. Select a provider.
3. Enter its API key and choose **Connect**.
4. Open the **Model** panel and select a model.

Provider credentials are sent to the local PenHub API and stored through the inherited OpenCode credential service. Do not commit API keys or put them in repository files.

## Security Tool Packs

The TUI and Web GUI can run without Docker or Podman, but OCI-backed security tool calls require one of them.

Check the local pack state:

```bash
bun run packages/cli/src/index.ts tools list
```

Pull every published pack:

```bash
bun run packages/cli/src/index.ts tools preload
```

Verify that every pack is available locally:

```bash
bun run packages/cli/src/index.ts tools verify
```

Pull one pack only:

```bash
bun run packages/cli/src/index.ts tools pull web
```

When a session invokes a packaged tool, PenHub:

1. Detects Docker or Podman.
2. Pulls the pack image if it is missing.
3. Mounts only the active workspace at `/workspace`.
4. Runs the selected command inside the image.
5. Stores the complete output under `.penhub/artifacts/tool-runs/`.
6. Returns only a compact preview and artifact path to the model loop.

### Build packs locally

The catalog currently uses matching `ghcr.io/penhub-ai/toolpack-*:0.1.0` tags. If those images are unavailable from GHCR, build the same tags locally.

For an AMD64 host:

```bash
cd toolpacks
docker buildx bake --set '*.platform=linux/amd64' --load
cd ..
```

For an ARM64 host:

```bash
cd toolpacks
docker buildx bake --set '*.platform=linux/arm64' --load
cd ..
```

Then rerun:

```bash
bun run packages/cli/src/index.ts tools verify
```

Release maintainers can build and push multi-platform images with:

```bash
cd toolpacks
docker buildx bake --push
bun run script/lock.ts
```

`toolpacks/images.lock.json` is the release digest lock. It should contain a registry digest for every pack before a release is treated as reproducible.

## CLI Reference

Show the full command help:

```bash
bun run packages/cli/src/index.ts --help
```

Common commands:

| Command                                               | Purpose                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------- |
| `bun run dev`                                         | Start the TUI and its local background API                           |
| `bun run dev:gui`                                     | Start the Web GUI development server on port 3000                    |
| `bun run packages/cli/src/index.ts serve`             | Start a standalone API, selecting the first available port from 4096 |
| `bun run packages/cli/src/index.ts serve --port 4096` | Start a standalone API on a fixed port                               |
| `bun run packages/cli/src/index.ts service status`    | Inspect the managed background API                                   |
| `bun run packages/cli/src/index.ts service restart`   | Restart the managed background API                                   |
| `bun run packages/cli/src/index.ts tools list`        | List tool packs and local image state                                |
| `bun run packages/cli/src/index.ts tools preload`     | Pull every tool pack                                                 |
| `bun run packages/cli/src/index.ts tools verify`      | Require every tool-pack image to be present                          |

## Build From Source

### Web GUI production assets

```bash
cd packages/app
bun run build
```

The output is written to `packages/app/dist/`. Preview it locally with:

```bash
bun run serve
```

The built frontend still needs a running PenHub API. Open `penhub.html` and pass the API with the `server` query parameter when it is not using port 4096.

### Native CLI for the current platform

The source workflow does not require a compiled binary. To build one for the current operating system and CPU:

```bash
cd packages/cli
bun run script/build.ts --single
```

The binary is written below `packages/cli/dist/cli-<platform>-<architecture>/bin/` and retains the historical internal filename `lildax`.

## Durable Workspace State

PenHub keeps security-session state inside the active workspace:

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

Raw tool output belongs in `.penhub/artifacts`; compact state cards are passed into the model loop. Do not paste long logs directly into prompts when the artifact path is available.

## Development Validation

Do not run tests from the repository root. Run package checks from the package being changed.

Core PenHub tests and typecheck:

```bash
cd packages/core
bun test test/penhub/toolpack.test.ts test/agent.test.ts
bun typecheck
```

Web GUI typecheck and build:

```bash
cd packages/app
bun typecheck
bun run build
```

CLI typecheck:

```bash
cd packages/cli
bun typecheck
```

## Troubleshooting

### The browser says the API is unavailable

Confirm the standalone server is still running and that its printed port matches the `server` query parameter. The default browser URL expects port 4096.

```bash
OPENCODE_SERVER_PASSWORD= bun run packages/cli/src/index.ts serve --port 4096
```

### Port 4096 is already in use

Start on another port and point the GUI to it:

```bash
OPENCODE_SERVER_PASSWORD= bun run packages/cli/src/index.ts serve --port 4097
```

```text
http://localhost:3000/penhub.html?server=http://localhost:4097
```

Alternatively, omit `--port`; the server searches from 4096 upward and prints the selected address.

### No models are available

Connect a provider first. Use `/connect` in the TUI or the **Provider** panel in the Web GUI, then choose a model with `/models` or the **Model** panel.

### A packaged tool reports that Docker or Podman is missing

Install and start Docker or Podman, verify that `docker version` or `podman version` succeeds, then run:

```bash
bun run packages/cli/src/index.ts tools list
```

### A tool-pack image cannot be pulled

Build the pack images locally with Docker Buildx using the commands in [Build packs locally](#build-packs-locally). The local tags match the runtime catalog.

### The TUI's background service is stale

```bash
bun run packages/cli/src/index.ts service restart
bun run packages/cli/src/index.ts service status
```

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

PenHub remains an OpenCode-derived runtime. It does not add a separate orchestrator, database server, queue, or external model service beside OpenCode's package architecture.

## Upstream Attribution

PenHub extends OpenCode's package layout, Session runtime, provider integrations, Client, TUI, and App foundations. OpenCode is maintained at <https://github.com/anomalyco/opencode>.

## License

PenHub is distributed under the MIT License inherited from the upstream project.
