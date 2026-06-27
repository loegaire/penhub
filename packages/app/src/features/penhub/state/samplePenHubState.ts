import type { WorkspaceState } from "@opencode-ai/core/penhub/index"

export type PenHubActionLogItem = {
  id: string
  action: string
  status: "queued" | "running" | "completed" | "failed"
  branchId: string
  hypothesisId?: string
  summary: string
  artifactPath?: string
  durationSeconds: number
}

export type PenHubBenchmarkSnapshot = {
  isSampleData: boolean
  caseId: string
  model: string
  baseline: {
    runner: "opencode-baseline"
    success: boolean
    flagFound: boolean
    totalTokens: number
    toolCallsCount: number
    repeatedActionsCount: number
    humanInterventionsCount: number
    reportGenerated: boolean
  }
  penhub: {
    runner: "penhub"
    success: boolean
    flagFound: boolean
    totalTokens: number
    toolCallsCount: number
    repeatedActionsCount: number
    humanInterventionsCount: number
    evidenceItemsCount: number
    reportGenerated: boolean
  }
  deltas: {
    tokens: number
    toolCalls: number
    repeatedActions: number
    humanInterventions: number
  }
  conclusion: string
}

export type PenHubWorkspaceFixture = {
  isSampleData: boolean
  workspace: WorkspaceState
  actions: PenHubActionLogItem[]
  reportMarkdown: string
  benchmark: PenHubBenchmarkSnapshot
}

const createdAt = "2026-06-27T08:00:00.000Z"

export const samplePenHubWorkspace: PenHubWorkspaceFixture = {
  isSampleData: true,
  workspace: {
    challenge: {
      id: "challenge_local_web_chain_001",
      name: "Local Web Chain 001",
      type: "web",
      goal: "Recover the sample flag from a local web challenge by chaining recon, auth bypass, and evidence-backed reporting.",
      workspacePath: "/workspace/penhub/local-web-chain-001",
      createdAt,
    },
    facts: [
      {
        id: "fact_login_form",
        source: "tool",
        claim: "The target exposes a login form and a JSON API under /api.",
        confidence: 0.92,
        evidenceIds: ["ev_http_login"],
        branchId: "branch_recon",
        createdAt,
      },
      {
        id: "fact_debug_header",
        source: "tool",
        claim: "The debug response header discloses a test tenant identifier.",
        confidence: 0.86,
        evidenceIds: ["ev_http_headers"],
        branchId: "branch_auth_bypass",
        createdAt,
      },
      {
        id: "fact_rate_limit",
        source: "runtime",
        claim: "The API starts throttling after five repeated credential guesses.",
        confidence: 0.78,
        evidenceIds: ["ev_rate_limit"],
        branchId: "branch_password_spray",
        createdAt,
      },
      {
        id: "fact_flag_endpoint",
        source: "tool",
        claim: "Authenticated requests to /api/profile include a field named sample_flag_preview.",
        confidence: 0.81,
        evidenceIds: ["ev_profile_preview"],
        branchId: "branch_auth_bypass",
        createdAt,
      },
      {
        id: "fact_report_ready",
        source: "model",
        claim: "The confirmed branch has enough evidence for a replayable report section.",
        confidence: 0.74,
        evidenceIds: ["ev_flag"],
        branchId: "branch_report",
        createdAt,
      },
    ],
    hypotheses: [
      {
        id: "hyp_debug_tenant",
        claim: "A disclosed test tenant can bypass the normal login flow.",
        status: "testing",
        requiredEvidence: ["ev_http_headers", "ev_profile_preview"],
        nextTest: "Replay the tenant header against /api/profile with a fresh session cookie.",
        confidence: 0.74,
        branchId: "branch_auth_bypass",
        createdAt,
        updatedAt: "2026-06-27T08:05:00.000Z",
      },
      {
        id: "hyp_hidden_admin",
        claim: "The /admin route may expose challenge metadata after authenticated access.",
        status: "open",
        requiredEvidence: ["ev_admin_route"],
        nextTest: "Probe /admin with the test tenant identity after auth replay.",
        confidence: 0.52,
        branchId: "branch_admin_route",
        createdAt,
        updatedAt: "2026-06-27T08:04:00.000Z",
      },
      {
        id: "hyp_flag_profile",
        claim: "The flag is recoverable from the profile API once tenant auth is replayed.",
        status: "confirmed",
        requiredEvidence: ["ev_profile_preview", "ev_flag"],
        confidence: 0.91,
        branchId: "branch_report",
        createdAt,
        updatedAt: "2026-06-27T08:06:00.000Z",
      },
      {
        id: "hyp_password_spray",
        claim: "Default credentials can be sprayed without triggering lockout.",
        status: "failed",
        requiredEvidence: ["ev_rate_limit"],
        confidence: 0.18,
        branchId: "branch_password_spray",
        createdAt,
        updatedAt: "2026-06-27T08:03:00.000Z",
      },
    ],
    branches: [
      {
        id: "branch_auth_bypass",
        goal: "Validate the disclosed tenant header and recover profile evidence.",
        status: "active",
        confidence: 0.78,
        progress: 0.72,
        novelty: 0.7,
        tokenCost: 9_200,
        repetitionPenalty: 0.05,
        evidenceIds: ["ev_http_headers", "ev_profile_preview"],
        hypothesisIds: ["hyp_debug_tenant"],
        createdAt,
        updatedAt: "2026-06-27T08:05:00.000Z",
      },
      {
        id: "branch_report",
        goal: "Convert confirmed evidence into a replayable report.",
        status: "confirmed",
        confidence: 0.9,
        progress: 0.94,
        novelty: 0.45,
        tokenCost: 5_200,
        repetitionPenalty: 0,
        evidenceIds: ["ev_flag"],
        hypothesisIds: ["hyp_flag_profile"],
        createdAt,
        updatedAt: "2026-06-27T08:06:00.000Z",
      },
      {
        id: "branch_password_spray",
        goal: "Try default credential combinations against the login form.",
        status: "failed",
        confidence: 0.16,
        progress: 0.22,
        novelty: 0.28,
        tokenCost: 7_100,
        repetitionPenalty: 0.65,
        evidenceIds: ["ev_rate_limit"],
        hypothesisIds: ["hyp_password_spray"],
        createdAt,
        updatedAt: "2026-06-27T08:03:00.000Z",
      },
      {
        id: "branch_recon",
        goal: "Map public routes and identify API behavior.",
        status: "stale",
        confidence: 0.62,
        progress: 0.6,
        novelty: 0.2,
        tokenCost: 4_500,
        repetitionPenalty: 0.35,
        evidenceIds: ["ev_http_login"],
        hypothesisIds: [],
        createdAt,
        updatedAt: "2026-06-27T08:02:00.000Z",
      },
    ],
    evidence: [
      {
        id: "ev_http_login",
        type: "http",
        summary: "GET /login returned the login form and linked /api/session.",
        artifactPath: ".penhub/artifacts/http-login.txt",
        hash: "sha256:sample-login",
        supports: ["fact_login_form"],
        branchId: "branch_recon",
        createdAt,
      },
      {
        id: "ev_http_headers",
        type: "http",
        summary: "Response headers included X-Debug-Tenant: sample-test.",
        artifactPath: ".penhub/artifacts/http-headers.txt",
        hash: "sha256:sample-headers",
        supports: ["fact_debug_header", "hyp_debug_tenant"],
        branchId: "branch_auth_bypass",
        hypothesisId: "hyp_debug_tenant",
        createdAt,
      },
      {
        id: "ev_rate_limit",
        type: "log",
        summary: "Credential spray attempts returned 429 after five requests.",
        artifactPath: ".penhub/artifacts/rate-limit.log",
        hash: "sha256:sample-rate-limit",
        supports: ["fact_rate_limit", "hyp_password_spray"],
        branchId: "branch_password_spray",
        hypothesisId: "hyp_password_spray",
        createdAt,
      },
      {
        id: "ev_profile_preview",
        type: "http",
        summary: "Tenant replay returned profile JSON with sample_flag_preview.",
        artifactPath: ".penhub/artifacts/profile-preview.json",
        hash: "sha256:sample-profile",
        supports: ["fact_flag_endpoint", "hyp_debug_tenant", "hyp_flag_profile"],
        branchId: "branch_auth_bypass",
        hypothesisId: "hyp_debug_tenant",
        createdAt,
      },
      {
        id: "ev_flag",
        type: "flag",
        summary: "Sample fixture flag recovered from the profile endpoint.",
        artifactPath: ".penhub/artifacts/flag.txt",
        hash: "sha256:sample-flag",
        supports: ["hyp_flag_profile", "fact_report_ready"],
        branchId: "branch_report",
        hypothesisId: "hyp_flag_profile",
        createdAt,
      },
      {
        id: "ev_report",
        type: "manual",
        summary: "Report preview includes replay steps and evidence hashes.",
        artifactPath: ".penhub/state/report.md",
        hash: "sha256:sample-report",
        supports: ["fact_report_ready"],
        branchId: "branch_report",
        createdAt,
      },
    ],
    tokenUsage: {
      totalInputTokens: 18_000,
      totalOutputTokens: 12_000,
      totalTokens: 30_000,
      byBranch: {
        branch_auth_bypass: 9_200,
        branch_report: 5_200,
        branch_password_spray: 7_100,
        branch_recon: 4_500,
      },
      byAction: {
        http_probe: 8_400,
        state_update: 2_600,
        evidence_capture: 3_200,
        report_preview: 4_800,
      },
      byHypothesis: {
        hyp_debug_tenant: 8_700,
        hyp_hidden_admin: 2_200,
        hyp_flag_profile: 5_200,
        hyp_password_spray: 7_100,
      },
      compressionRatio: 0.38,
    },
  },
  actions: [
    {
      id: "action_http_probe_login",
      action: "http_probe",
      status: "completed",
      branchId: "branch_recon",
      summary: "Fetched /login and recorded compact HTTP observation.",
      artifactPath: ".penhub/artifacts/http-login.txt",
      durationSeconds: 3,
    },
    {
      id: "action_http_probe_headers",
      action: "http_probe",
      status: "completed",
      branchId: "branch_auth_bypass",
      hypothesisId: "hyp_debug_tenant",
      summary: "Captured debug tenant header without injecting raw response into context.",
      artifactPath: ".penhub/artifacts/http-headers.txt",
      durationSeconds: 4,
    },
    {
      id: "action_password_spray",
      action: "http_probe",
      status: "failed",
      branchId: "branch_password_spray",
      hypothesisId: "hyp_password_spray",
      summary: "Stopped after rate-limit evidence contradicted the branch.",
      artifactPath: ".penhub/artifacts/rate-limit.log",
      durationSeconds: 18,
    },
    {
      id: "action_report_preview",
      action: "report_generate",
      status: "completed",
      branchId: "branch_report",
      hypothesisId: "hyp_flag_profile",
      summary: "Generated sample replay section with artifact hashes.",
      artifactPath: ".penhub/state/report.md",
      durationSeconds: 5,
    },
  ],
  reportMarkdown: [
    "# Sample PenHub Report",
    "",
    "## Finding",
    "Tenant replay exposed a profile API path containing the sample fixture flag.",
    "",
    "## Evidence",
    "- `ev_http_headers`: debug tenant header, stored at `.penhub/artifacts/http-headers.txt`.",
    "- `ev_profile_preview`: profile JSON preview, stored at `.penhub/artifacts/profile-preview.json`.",
    "- `ev_flag`: sample fixture flag artifact.",
    "",
    "## Replay",
    "1. Request `/login` and record the session cookie.",
    "2. Replay `X-Debug-Tenant: sample-test` against `/api/profile`.",
    "3. Verify the profile response hash against the evidence artifact.",
  ].join("\n"),
  benchmark: {
    isSampleData: true,
    caseId: "local-web-chain-001",
    model: "sample-model",
    baseline: {
      runner: "opencode-baseline",
      success: false,
      flagFound: false,
      totalTokens: 42_000,
      toolCallsCount: 16,
      repeatedActionsCount: 5,
      humanInterventionsCount: 2,
      reportGenerated: false,
    },
    penhub: {
      runner: "penhub",
      success: true,
      flagFound: true,
      totalTokens: 30_000,
      toolCallsCount: 10,
      repeatedActionsCount: 1,
      humanInterventionsCount: 0,
      evidenceItemsCount: 6,
      reportGenerated: true,
    },
    deltas: {
      tokens: -12_000,
      toolCalls: -6,
      repeatedActions: -4,
      humanInterventions: -2,
    },
    conclusion: "Sample fixture for UI and harness validation only; not a measured product claim.",
  },
}
