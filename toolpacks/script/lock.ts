import { resolve } from "node:path"

const packs = ["web", "browser", "audit", "binary", "forensics", "crypto"] as const
const registry = process.env.REGISTRY ?? "ghcr.io/penhub-ai"
const version = process.env.VERSION ?? "0.1.0"
const images = Object.fromEntries(
  await Promise.all(
    packs.map(async (pack) => {
      const image = `${registry}/toolpack-${pack}:${version}`
      const process = Bun.spawn(["docker", "buildx", "imagetools", "inspect", image, "--format", "{{json .Manifest.Digest}}"], {
        stdout: "pipe",
        stderr: "inherit",
      })
      const digest = JSON.parse((await new Response(process.stdout).text()).trim()) as string
      if ((await process.exited) !== 0 || !/^sha256:[0-9a-f]{64}$/.test(digest)) throw new Error(`Missing digest: ${image}`)
      return [pack, { image, digest }] as const
    }),
  ),
)

await Bun.write(resolve(import.meta.dir, "../images.lock.json"), JSON.stringify({ version, images }, null, 2) + "\n")
