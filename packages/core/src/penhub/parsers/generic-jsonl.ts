export function parseJsonLines(raw: string): unknown[] {
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        const parsed: unknown = JSON.parse(line)
        return parsed
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new Error(`Invalid JSONL parser input at line ${index + 1}: ${detail}`, { cause: error })
      }
    })
}
