export type FfufFinding = {
  url: string
  status: number
  length?: number
  words?: number
  lines?: number
}

export function parseFfufJson(raw: string): FfufFinding[] {
  const parsed = JSON.parse(raw) as { results?: unknown[] }
  return (parsed.results ?? []).filter(isRecord).map((item) => {
    const input = isRecord(item.input) ? item.input : {}
    return {
      url: String(item.url ?? input.FUZZ ?? ""),
      status: Number(item.status),
      ...(item.length !== undefined ? { length: Number(item.length) } : {}),
      ...(item.words !== undefined ? { words: Number(item.words) } : {}),
      ...(item.lines !== undefined ? { lines: Number(item.lines) } : {}),
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
