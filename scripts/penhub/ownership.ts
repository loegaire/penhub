export type CodexId = "1" | "2" | "3"

type OwnershipRule = {
  allowedPrefixes: string[]
  blockedPrefixes?: string[]
}

const ownershipRules: Record<CodexId, OwnershipRule> = {
  "1": {
    allowedPrefixes: [
      "packages/core/src/penhub/",
      "packages/core/test/penhub/",
      ".opencode/tool/penhub-init-challenge.ts",
      ".opencode/tool/penhub-state-card.ts",
      "docs/penhub/",
    ],
  },
  "2": {
    allowedPrefixes: [
      "packages/core/src/penhub/action-runtime/",
      "packages/core/src/penhub/actions/",
      "packages/core/src/penhub/report/",
      "packages/core/src/penhub/replay/",
      "packages/core/src/penhub/action-parsers/",
      "packages/core/test/penhub/action-runtime/",
      "packages/core/test/penhub/actions/",
      "packages/core/test/penhub/report/",
      "packages/core/test/penhub/replay/",
      ".opencode/tool/penhub-",
      "docs/penhub/",
    ],
    blockedPrefixes: ["packages/app/", "packages/opencode/src/server/", "benchmarks/", "harness/", ".github/"],
  },
  "3": {
    allowedPrefixes: [
      "packages/app/src/features/penhub/",
      "packages/app/src/app.tsx",
      "packages/app/src/pages/penhub",
      "packages/app/src/penhub",
      "packages/opencode/src/server/routes/penhub",
      "packages/opencode/src/server/penhub",
      "benchmarks/penhub/",
      "harness/penhub/",
      "scripts/penhub/",
      "docs/penhub/",
      ".github/",
    ],
    blockedPrefixes: ["packages/core/src/penhub/", "packages/core/test/penhub/", ".opencode/tool/penhub-"],
  },
}

export function checkOwnedPaths(input: { codexId: string; changedFiles: string[] }) {
  if (!isCodexId(input.codexId)) throw new Error("CODEX_ID must be 1, 2, or 3")
  const rule = ownershipRules[input.codexId]

  return input.changedFiles.filter((file) => isBlocked(file, rule) || !isAllowed(file, rule))
}

function isCodexId(value: string): value is CodexId {
  return value === "1" || value === "2" || value === "3"
}

function isAllowed(file: string, rule: OwnershipRule) {
  return rule.allowedPrefixes.some((prefix) => file.startsWith(prefix))
}

function isBlocked(file: string, rule: OwnershipRule) {
  return (rule.blockedPrefixes ?? []).some((prefix) => file.startsWith(prefix))
}
