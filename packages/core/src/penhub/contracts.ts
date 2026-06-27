import { z } from "zod/v4"

export const TargetRef = z.object({
  kind: z.enum(["url", "host", "api"]),
  value: z.string(),
})

export const HttpProbeArgs = z.object({
  target: TargetRef,
  method: z.enum(["GET", "HEAD", "POST"]).default("GET"),
  path: z.string().default("/"),
  headers: z.record(z.string(), z.string()).default({}),
  timeoutSec: z.number().int().min(1).max(30).default(10),
})

export const DirFuzzArgs = z.object({
  baseUrl: z.string().url(),
  wordlist: z.string(),
  extensions: z.array(z.string()).default([]),
  rate: z.number().int().min(1).max(200).default(50),
  timeoutSec: z.number().int().min(1).max(120).default(30),
})

export const VulnerabilityScanArgs = z.object({
  baseUrl: z.string().url(),
  templates: z.array(z.string()).default([]),
  severity: z.array(z.enum(["info", "low", "medium", "high", "critical"])).default(["medium", "high", "critical"]),
})

export const ApiFuzzArgs = z.object({
  schemaPath: z.string(),
  baseUrl: z.string().url(),
  maxExamples: z.number().int().min(1).max(1_000).default(100),
})

export type HttpProbeArgs = z.infer<typeof HttpProbeArgs>
export type DirFuzzArgs = z.infer<typeof DirFuzzArgs>
export type VulnerabilityScanArgs = z.infer<typeof VulnerabilityScanArgs>
export type ApiFuzzArgs = z.infer<typeof ApiFuzzArgs>
