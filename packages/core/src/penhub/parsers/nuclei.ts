import { parseJsonLines } from "./generic-jsonl"

export type NucleiFinding = {
  templateId?: string
  severity?: string
  matchedAt?: string
  name?: string
}

export function parseNucleiJsonl(raw: string): NucleiFinding[] {
  return parseJsonLines<unknown>(raw)
    .filter(isRecord)
    .map((item) => {
      const info = isRecord(item.info) ? item.info : {}
      return {
        ...(item["template-id"] ? { templateId: String(item["template-id"]) } : {}),
        ...(info.severity ? { severity: String(info.severity) } : {}),
        ...(item["matched-at"] ? { matchedAt: String(item["matched-at"]) } : {}),
        ...(info.name ? { name: String(info.name) } : {}),
      }
    })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
