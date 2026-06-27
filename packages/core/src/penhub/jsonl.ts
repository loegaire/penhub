import { readFile, writeFile } from "node:fs/promises"

export async function appendJsonl<T>(file: string, value: T) {
  await writeFile(file, JSON.stringify(value) + "\n", { flag: "a" })
}

export async function readJsonl<T>(file: string): Promise<T[]> {
  let raw = ""
  try {
    raw = await readFile(file, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as T
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new Error(`Invalid PenHub JSONL at ${file}:${index + 1}: ${detail}`, { cause: error })
      }
    })
}

export async function writeJsonl<T>(file: string, values: T[]) {
  await writeFile(file, values.length ? values.map((value) => JSON.stringify(value)).join("\n") + "\n" : "", {
    flag: "w",
  })
}
