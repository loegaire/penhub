import { readFile, writeFile } from "node:fs/promises"

export async function appendJsonl(file: string, value: unknown) {
  await writeFile(file, JSON.stringify(value) + "\n", { flag: "a" })
}

export async function readJsonl(file: string): Promise<unknown[]> {
  let raw = ""
  try {
    raw = await readFile(file, "utf8")
  } catch (error) {
    if (errorCode(error) === "ENOENT") return []
    throw error
  }
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        const parsed: unknown = JSON.parse(line)
        return parsed
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new Error(`Invalid PenHub JSONL at ${file}:${index + 1}: ${detail}`, { cause: error })
      }
    })
}

export async function writeJsonl(file: string, values: readonly unknown[]) {
  await writeFile(file, values.length ? values.map((value) => JSON.stringify(value)).join("\n") + "\n" : "", {
    flag: "w",
  })
}

function errorCode(error: unknown) {
  return error && typeof error === "object" ? Reflect.get(error, "code") : undefined
}
