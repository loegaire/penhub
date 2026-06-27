import { parseJsonLines } from "./generic-jsonl"

export type NucleiFinding = {
  templateId?: string
  severity?: string
  matchedAt?: string
  name?: string
}

export function parseNucleiJsonl(raw: string): NucleiFinding[] {
  return parseJsonLines(raw)
    .filter(isRecord)
    .map((item) => {
      const info = isRecord(item.info) ? item.info : {}
      const templateId = scalarString(item["template-id"])
      const severity = scalarString(info.severity)
      const matchedAt = scalarString(item["matched-at"])
      const name = scalarString(info.name)
      return {
        ...(templateId ? { templateId } : {}),
        ...(severity ? { severity } : {}),
        ...(matchedAt ? { matchedAt } : {}),
        ...(name ? { name } : {}),
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
