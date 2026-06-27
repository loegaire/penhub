export type FfufFinding = {
  url: string
  status: number
  length?: number
  words?: number
  lines?: number
}

export function parseFfufJson(raw: string): FfufFinding[] {
  const parsed: unknown = JSON.parse(raw)
  const results = isRecord(parsed) && Array.isArray(parsed.results) ? parsed.results : []
  return results.filter(isRecord).map((item) => {
    const input = isRecord(item.input) ? item.input : {}
    const url = scalarString(item.url) ?? scalarString(input.FUZZ) ?? ""
    return {
      url,
      status: numericValue(item.status) ?? 0,
      ...optionalNumber("length", item.length),
      ...optionalNumber("words", item.words),
      ...optionalNumber("lines", item.lines),
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function scalarString(value: unknown) {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return undefined
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string" || value.trim().length === 0) return undefined
  const next = Number(value)
  return Number.isFinite(next) ? next : undefined
}

function optionalNumber(key: "length" | "words" | "lines", value: unknown) {
  const next = numericValue(value)
  return next === undefined ? {} : { [key]: next }
}
