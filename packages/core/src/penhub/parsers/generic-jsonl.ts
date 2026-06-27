export function parseJsonLines<T>(raw: string): T[] {
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as T
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new Error(`Invalid JSONL parser input at line ${index + 1}: ${detail}`, { cause: error })
      }
    })
}
