export type ParsedHttpResponse = {
  statusCode?: number
  contentType?: string
  bodyPreview: string
}

export function parseHttpResponse(raw: string): ParsedHttpResponse {
  const status = raw.match(/^HTTP\/\S+\s+(\d{3})/m)?.[1]
  const contentType = raw.match(/^content-type:\s*(.+)$/im)?.[1]?.trim()
  return {
    ...(status ? { statusCode: Number(status) } : {}),
    ...(contentType ? { contentType } : {}),
    bodyPreview: raw.split(/\r?\n\r?\n/).at(-1)?.slice(0, 1_000) ?? "",
  }
}
