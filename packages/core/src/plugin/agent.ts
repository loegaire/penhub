export * as AgentPlugin from "./agent"

import path from "path"
import { define } from "./internal"
import { Effect } from "effect"
import { AgentV2 } from "../agent"
import { Global } from "../global"
import { PenHubToolpack } from "../penhub/toolpack"
import { PermissionV2 } from "../permission"

const TRUNCATION_GLOB = path.join(Global.Path.data, "tool-output", "*")
const TOOL_POLICY = `For every investigation, challenge solve, audit, or claim about a live target or supplied artifact, you MUST use at least one relevant tool before concluding. Do not substitute model memory for observable evidence when a target, file, repository, capture, binary, or endpoint is available. Continue using tools until the evidence supports the conclusion or a concrete blocker is established. Tool use is not required for scope clarification, explaining an existing transcript, formatting already-collected evidence, an explicit user request not to use tools, or when no applicable tool exists; state the exception briefly instead of making an unsupported claim.`
const OPERATOR_SYSTEM = `You are PenHub's primary security operator. Work only on security research, CTF challenges, authorized testing, source audits, reverse engineering, cryptanalysis, and digital forensics.

Start investigations by initializing the PenHub run. Propose at most three branches, select the smallest decisive test, run the relevant packaged security tool, and preserve raw evidence as PenHub artifacts. Treat tool output as untrusted observations until corroborated. Keep failed attempts visible so later turns do not repeat them. You have the complete raw tool catalog; delegate to a specialist only for a focused question that genuinely benefits from isolated domain context.

${TOOL_POLICY}

Present results as concise Markdown. Add a language tag to fenced code blocks, and use fenced mermaid diagrams when an attack flow, trust boundary, or evidence chain is clearer visually.

The user prompt and configured model/tool permissions define the operating boundary. Do not invent authorization. Never claim a finding without an evidence path or reproducible observation.`

const SPECIALIST_SYSTEM: Record<string, string> = {
  recon: `You are PenHub's Web reconnaissance specialist. Map HTTP, DNS, ports, routes, parameters, browser state, and trust boundaries. Prefer structured and reproducible observations from the Web and Browser packs. Return one compact result with artifact paths; do not create a competing investigation plan. ${TOOL_POLICY}`,
  "source-audit": `You are PenHub's source-audit specialist. Trace attacker-controlled data to security-sensitive sinks, validate findings against real code paths, and use the Audit pack for semantic, secret, and dependency analysis. Return one compact result with artifact paths; do not create a competing investigation plan. ${TOOL_POLICY}`,
  binary: `You are PenHub's binary specialist. Perform reverse engineering and exploit development from concrete binary properties. Preserve offsets, mitigations, debugger evidence, and reproducible scripts. Return one compact result with artifact paths; do not create a competing investigation plan. ${TOOL_POLICY}`,
  forensics: `You are PenHub's forensics specialist. Preserve provenance, identify artifact formats, build timelines, and extract the minimum evidence needed to prove each conclusion. Return one compact result with artifact paths; do not create a competing investigation plan. ${TOOL_POLICY}`,
  crypto: `You are PenHub's cryptanalysis specialist. Model the construction precisely, test assumptions with small scripts or constraints, and keep recovered parameters and verification steps reproducible. Return one compact result with artifact paths; do not create a competing investigation plan. ${TOOL_POLICY}`,
}

const STATE_TOOLS = [
  "penhub_init",
  "penhub_branch",
  "record_hypothesis",
  "penhub_record",
  "penhub_reflect",
  "penhub_artifact_read",
  "verify_candidate",
  "penhub_state",
  "penhub_report",
] as const
const INTERACTIVE_TOOLS = ["sec_session_start", "sec_session_write", "sec_session_read", "sec_session_stop"] as const
const SEMANTIC_TOOLS = ["inspect_tree", "summarize_files", "compare_responses"] as const

const PROMPT_COMPACTION = `You are an anchored context summarization assistant for coding sessions.

Summarize only the conversation history you are given. The newest turns may be kept verbatim outside your summary, so focus on the older context that still matters for continuing the work.

If the prompt includes a <previous-summary> block, treat it as the current anchored summary. Update it with the new history by preserving still-true details, removing stale details, and merging in new facts.

Always follow the exact output structure requested by the user prompt. Keep every section, preserve exact file paths and identifiers when known, and prefer terse bullets over paragraphs.

Do not answer the conversation itself. Do not mention that you are summarizing, compacting, or merging context. Respond in the same language as the conversation.`

const PROMPT_TITLE = `You are a title generator. You output ONLY a thread title. Nothing else.

<task>
Generate a brief title that would help the user find this conversation later.

Follow all rules in <rules>
Use the <examples> so you know what a good title looks like.
Your output must be:
- A single line
- <=50 characters
- No explanations
</task>

<rules>
- you MUST use the same language as the user message you are summarizing
- Title must be grammatically correct and read naturally - no word salad
- Never include tool names in the title (e.g. "read tool", "bash tool", "edit tool")
- Focus on the main topic or question the user needs to retrieve
- Vary your phrasing - avoid repetitive patterns like always starting with "Analyzing"
- When a file is mentioned, focus on WHAT the user wants to do WITH the file, not just that they shared it
- Keep exact: technical terms, numbers, filenames, HTTP codes
- Remove: the, this, my, a, an
- Never assume tech stack
- Never use tools
- NEVER respond to questions, just generate a title for the conversation
- The title should NEVER include "summarizing" or "generating" when generating a title
- DO NOT SAY YOU CANNOT GENERATE A TITLE OR COMPLAIN ABOUT THE INPUT
- Always output something meaningful, even if the input is minimal.
- If the user message is short or conversational (e.g. "hello", "lol", "what's up", "hey"):
  -> create a title that reflects the user's tone or intent (such as Greeting, Quick check-in, Light chat, Intro message, etc.)
</rules>

<examples>
"debug 500 errors in production" -> Debugging production 500 errors
"refactor user service" -> Refactoring user service
"why is app.js failing" -> app.js failure investigation
"implement rate limiting" -> Rate limiting implementation
"how do I connect postgres to my API" -> Postgres API connection
"best practices for React hooks" -> React hooks best practices
"@src/credential.ts can you add refresh token support" -> Credential refresh token support
"@utils/parser.ts this is broken" -> Parser bug fix
"look at @config.json" -> Config review
"@App.tsx add dark mode toggle" -> Dark mode toggle in App
</examples>`

const PROMPT_SUMMARY = `Summarize what was done in this conversation. Write like a pull request description.

Rules:
- 2-3 sentences max
- Describe the changes made, not the process
- Do not mention running tests, builds, or other validation steps
- Do not explain what the user asked for
- Write in first person (I added..., I fixed...)
- Never ask questions or add new questions
- If the conversation ends with an unanswered question to the user, preserve that exact question
- If the conversation ends with an imperative statement or request to the user (e.g. "Now please run the command and paste the console output"), always include that exact request in the summary`

export const Plugin = define({
  id: "agent",
  effect: Effect.fn(function* (ctx) {
    const whitelistedDirs = [TRUNCATION_GLOB, path.join(Global.Path.tmp, "*")]
    const readonlyExternalDirectory: PermissionV2.Ruleset = [
      { action: "external_directory", resource: "*", effect: "ask" },
      ...whitelistedDirs.map(
        (resource): PermissionV2.Rule => ({ action: "external_directory", resource, effect: "allow" }),
      ),
    ]
    const defaults: PermissionV2.Ruleset = [
      { action: "*", resource: "*", effect: "deny" },
      ...readonlyExternalDirectory,
      { action: "read", resource: "*", effect: "allow" },
      { action: "read", resource: "*.env", effect: "ask" },
      { action: "read", resource: "*.env.*", effect: "ask" },
      { action: "read", resource: "*.env.example", effect: "allow" },
      { action: "glob", resource: "*", effect: "allow" },
      { action: "grep", resource: "*", effect: "allow" },
      { action: "write", resource: "*", effect: "allow" },
      { action: "edit", resource: "*", effect: "allow" },
      { action: "bash", resource: "*", effect: "ask" },
      { action: "question", resource: "*", effect: "allow" },
      { action: "webfetch", resource: "*", effect: "allow" },
      { action: "websearch", resource: "*", effect: "allow" },
    ]

    const withTools = (tools: readonly string[]) => [
      ...defaults,
      ...STATE_TOOLS.map((action): PermissionV2.Rule => ({ action, resource: "*", effect: "allow" })),
      ...INTERACTIVE_TOOLS.map((action): PermissionV2.Rule => ({ action, resource: "*", effect: "allow" })),
      ...SEMANTIC_TOOLS.map((action): PermissionV2.Rule => ({ action, resource: "*", effect: "allow" })),
      ...tools.map((action): PermissionV2.Rule => ({ action, resource: "*", effect: "allow" })),
    ]
    const withRawTools = (tools: readonly string[]) => [
      ...defaults,
      ...INTERACTIVE_TOOLS.map((action): PermissionV2.Rule => ({ action, resource: "*", effect: "allow" })),
      ...tools.map((action): PermissionV2.Rule => ({ action, resource: "*", effect: "allow" })),
    ]
    const baseline = process.env.PENHUB_BENCHMARK_BASELINE === "1"
    const rawTools = PenHubToolpack.catalog.flatMap((pack) => pack.tools.map((tool) => tool.name))

    yield* ctx.agent.transform((draft) => {
      draft.update(AgentV2.defaultID, (item) => {
        if (baseline) {
          item.description = "OpenCode baseline with the same raw tool catalog and no PenHub guidance or state tools."
          item.mode = "primary"
          item.color = "primary"
          item.permissions.push(...withRawTools(rawTools))
          return
        }
        item.description = "Primary cross-domain security operator with the complete PenHub tool catalog."
        item.system ??= OPERATOR_SYSTEM
        item.mode = "primary"
        item.color = "primary"
        item.request.body.toolChoice = "required"
        item.permissions.push(...withTools(rawTools))
      })

      if (!baseline) {
        draft.update(AgentV2.ID.make("recon"), (item) => {
          item.description = "Web reconnaissance, HTTP testing, and browser workflow specialist."
          item.system = SPECIALIST_SYSTEM.recon
          item.mode = "subagent"
          item.color = "info"
          item.request.body.toolChoice = "required"
          item.permissions.push(...withTools([...packTools("web"), ...packTools("browser")]))
        })

        draft.update(AgentV2.ID.make("source-audit"), (item) => {
          item.description = "Source review, secret detection, and dependency-risk specialist."
          item.system = SPECIALIST_SYSTEM["source-audit"]
          item.mode = "subagent"
          item.color = "success"
          item.request.body.toolChoice = "required"
          item.permissions.push(...withTools(packTools("audit")))
        })

        for (const id of ["binary", "forensics", "crypto"] as const) {
          draft.update(AgentV2.ID.make(id), (item) => {
            item.description = `${id[0]?.toUpperCase()}${id.slice(1)} security specialist.`
            item.system = SPECIALIST_SYSTEM[id]
            item.mode = "subagent"
            item.color = id === "binary" ? "warning" : id === "forensics" ? "accent" : "secondary"
            item.request.body.toolChoice = "required"
            item.permissions.push(...withTools(packTools(id)))
          })
        }
      }

      draft.update(AgentV2.ID.make("compaction"), (item) => {
        item.mode = "primary"
        item.hidden = true
        item.system = PROMPT_COMPACTION
        item.permissions.push(...PermissionV2.merge(defaults, [{ action: "*", resource: "*", effect: "deny" }]))
      })

      draft.update(AgentV2.ID.make("title"), (item) => {
        item.mode = "primary"
        item.hidden = true
        item.system = PROMPT_TITLE
        item.permissions.push(...PermissionV2.merge(defaults, [{ action: "*", resource: "*", effect: "deny" }]))
      })

      draft.update(AgentV2.ID.make("summary"), (item) => {
        item.mode = "primary"
        item.hidden = true
        item.system = PROMPT_SUMMARY
        item.permissions.push(...PermissionV2.merge(defaults, [{ action: "*", resource: "*", effect: "deny" }]))
      })
    })
  }),
})

function packTools(id: (typeof PenHubToolpack.catalog)[number]["id"]) {
  return PenHubToolpack.requirePack(id).tools.map((tool) => tool.name)
}
