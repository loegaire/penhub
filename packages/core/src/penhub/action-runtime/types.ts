export type PenHubActionRiskLevel = "read-only" | "local-exec" | "network-local" | "manual"

export type PenHubActionSchema<T> = {
  parse(value: unknown): T
}

export type PenHubActionContext = {
  workspacePath: string
  now?: () => string
  idGenerator?: () => string
  maxInlineChars?: number
  maxSummaryChars?: number
}

export type PenHubActionManifest<Input, Output> = {
  name: string
  description: string
  riskLevel: PenHubActionRiskLevel
  inputSchema: PenHubActionSchema<Input>
  outputSchema: PenHubActionSchema<Output>
  run(input: Input, context: PenHubActionContext): Promise<Output> | Output
}

export type PenHubActionSummary = {
  name: string
  description: string
  riskLevel: PenHubActionRiskLevel
}
