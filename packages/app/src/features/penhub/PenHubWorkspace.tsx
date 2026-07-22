import {
  type EventsSubscribeOutput,
  OpenCode,
  type ServerIntegrationListOutput,
  type ServerModelListOutput,
  type ServerPenhubStatusOutput,
  type SessionsContextOutput,
  type SessionsListOutput,
} from "@opencode-ai/client"
import { Icon } from "@opencode-ai/ui/icon"
import {
  batch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
  type JSX,
} from "solid-js"
import { createStore } from "solid-js/store"
import { ACCEPTED_FILE_TYPES, attachmentMime } from "@/components/prompt-input/files"
import { useServerSDK } from "@/context/server-sdk"
import { authTokenFromCredentials } from "@/utils/server"
import { errorFromResponse, formatServerError, isServerError } from "@/utils/server-errors"
import { loadPenHubState } from "./state/loadPenHubState"
import { PenHubMarkdown } from "./PenHubMarkdown"
import "./PenHubWorkspace.css"

type Connection = { url: string; headers?: HeadersInit }
type AgentInfo = {
  id: string
  description?: string
  mode: "subagent" | "primary" | "all"
  hidden: boolean
}
type PermissionRequest = {
  id: string
  sessionID: string
  action: string
  resources: readonly string[]
}
type QuestionRequest = {
  id: string
  sessionID: string
  questions: readonly {
    question: string
    header: string
    options: readonly { label: string; description: string }[]
    multiple?: boolean
    custom?: boolean
  }[]
}
type DataResponse<T> = { data: T }
type LocationResponse<T> = { data: T }
type ModelInfo = ServerModelListOutput["data"][number]
type PenHubWorkspaceInfo = Awaited<ReturnType<typeof loadPenHubState>>["state"]["data"]["workspace"]
type SessionMessageInfo = SessionsContextOutput[number]
type AssistantMessageInfo = Extract<SessionMessageInfo, { type: "assistant" }>
type AssistantContent = AssistantMessageInfo["content"][number]
type MessageFile = NonNullable<Extract<SessionMessageInfo, { type: "user" }>["files"]>[number]
type PromptAttachment = { id: string; name: string; mime: string; uri: string }
type FileEntry = { path: string; type: "file" | "directory" }
type SessionListInfo = SessionsListOutput["data"][number]
type ToolState = Extract<
  Extract<SessionMessageInfo, { type: "assistant" }>["content"][number],
  { type: "tool" }
>["state"]
type ExplorerAttempt = {
  id: string
  sessionId: string
  callId: string
  branchId?: string
  tool: string
  normalizedArgsHash: string
  status: "success" | "error" | "timeout" | string
  observation: string
  observationHash: string
  artifactPath?: string
  startedAt: string
  finishedAt: string
  durationMs: number
  outputBytes: number
}
type ExplorerLesson = {
  id: string
  branchId: string
  attemptIds: readonly string[]
  failedAssumption: string
  validObservations: readonly string[]
  avoid: string
  nextTest: string
  createdAt: string
}
type ExplorerFinding = {
  id: string
  claim: string
  candidate: string
  verificationMethod: string
  artifactPaths: readonly string[]
  verifiedAt: string
}
type ExplorerRunBranch = {
  id: string
  goal?: string
  claim?: string
  status: "queued" | "active" | "supported" | "refuted" | "blocked" | "open" | "confirmed" | "failed" | "stale" | string
  attempts?: number
  novelty?: number | "-Infinity" | "Infinity" | "NaN"
  confidence?: number | "-Infinity" | "Infinity" | "NaN"
  progress?: number | "-Infinity" | "Infinity" | "NaN"
  evidenceIds: readonly string[]
  updatedAt: string
}
type ExplorerRunState = {
  status: "active" | "solved" | "blocked" | "budget-exhausted"
  phase: "plan" | "act" | "verify" | "reflect" | "complete"
  sessionId: string
  goal: string
  branches: readonly ExplorerRunBranch[]
  findings: readonly ExplorerFinding[]
}
type ArtifactReadMode = "head" | "tail" | "lines" | "grep"
type PenHubExplorerTab =
  | "overview"
  | "state-card"
  | "facts"
  | "hypotheses"
  | "branches"
  | "attempts"
  | "lessons"
  | "findings"
  | "artifacts"
type PenHubMainTab = "session" | "evidence" | PenHubExplorerTab
type PenHubExplorerPayload = {
  initialized: boolean
  workspace: PenHubWorkspaceInfo | undefined
  stateCard: string
  run: ExplorerRunState | undefined
  attempts: readonly ExplorerAttempt[]
  lessons: readonly ExplorerLesson[]
  findings: readonly ExplorerFinding[]
}
type ArtifactViewerState = {
  path: string
  mode: ArtifactReadMode
  offset: number
  limit: number
  pattern?: string
}
type ArtifactReadState = {
  path: string
  mode: ArtifactReadMode
  offset: number
  limit: number
  pattern?: string
}
type ArtifactReadOutput = {
  path: string
  mode: ArtifactReadMode
  output: string
  totalLines: number
  returnedLines: number
  truncated: boolean
}

async function loadPenHubExplorer(connection: Connection) {
  return apiRequest<LocationResponse<PenHubExplorerPayload>>(connection, "/api/penhub/explorer").then((response) => response.data)
}

async function readArtifact(connection: Connection, input: ArtifactReadState) {
  return apiRequest<LocationResponse<ArtifactReadOutput>>(connection, "/api/penhub/artifact", {
    method: "POST",
    body: JSON.stringify({
      path: input.path,
      mode: input.mode,
      offset: input.offset,
      limit: input.limit,
      pattern: input.pattern,
    }),
  }).then((response) => response.data)
}

function readArtifactQuery(): ArtifactViewerState | undefined {
  const params = new URLSearchParams(window.location.search)
  const path = params.get("artifact")
  if (!path) return
  const mode = (params.get("artifactMode") as ArtifactReadMode | null) ?? "tail"
  const offset = Number(params.get("artifactOffset") ?? 0)
  const limit = Number(params.get("artifactLimit") ?? 250)
  const pattern = params.get("artifactPattern") ?? undefined
  if (!isArtifactMode(mode)) return
  if (!Number.isFinite(offset) || offset < 0) return
  if (!Number.isFinite(limit) || limit < 1 || limit > 500) return
  return { path, mode, offset: Math.floor(offset), limit: Math.floor(limit), pattern }
}

function readInitialWorkspace() {
  if (typeof window === "undefined") return ""
  return window.location.search.replace(/^\?/, "").length > 0
    ? new URLSearchParams(window.location.search).get("workspace") ?? ""
    : ""
}

function readInitialTranscriptFull() {
  if (typeof window === "undefined") return false
  return new URLSearchParams(window.location.search).get("transcript") === "full"
}

function isArtifactMode(value: string): value is ArtifactReadMode {
  return value === "head" || value === "tail" || value === "lines" || value === "grep"
}

export default function PenHubWorkspace(props: { serverUrl?: string; workspace?: string } = {}) {
  const serverSDK = props.serverUrl ? undefined : useServerSDK()
  const initialDirectory = props.workspace?.trim() || readInitialWorkspace()
  const transcriptFull = readInitialTranscriptFull()
  const [workspaceDirectory, setWorkspaceDirectory] = createSignal(initialDirectory)
  const [workspaceDialog, setWorkspaceDialog] = createSignal(false)
  const [workspaceInput, setWorkspaceInput] = createSignal(initialDirectory)
  const [artifactViewer, setArtifactViewer] = createSignal<ArtifactViewerState | undefined>(readArtifactQuery())
  const [mainTab, setMainTab] = createSignal<PenHubMainTab>("session")
  const [timeline, setTimeline] = createStore({ limit: transcriptFull ? Number.MAX_SAFE_INTEGER : 80 })
  const [recentWorkspaces, setRecentWorkspaces] = createSignal(loadRecentWorkspaces())
  const baseConnection = createMemo<Connection>(() => {
    if (props.serverUrl) return { url: props.serverUrl }
    const server = serverSDK!().server.http
    return {
      url: server.url,
      headers: server.password
        ? {
            Authorization: `Basic ${authTokenFromCredentials({ username: server.username, password: server.password })}`,
          }
        : undefined,
    }
  })
  const connection = createMemo(() => connectionAtWorkspace(baseConnection(), workspaceDirectory()))
  const client = createMemo(() => OpenCode.make({ baseUrl: connection().url, headers: connection().headers }))
  const [view, { mutate: mutateView, refetch }] = createResource(client, loadPenHubState)
  const currentDirectory = createMemo(() => workspaceDirectory() || view()?.state.location.directory || "")
  const [explorer, { refetch: refetchExplorer }] = createResource(currentDirectory, (directory) =>
    directory ? loadPenHubExplorer(connection()) : undefined,
  )
  const [workspaceSessions] = createResource(client, (value) => value.sessions.list({ limit: 100, order: "desc" }))
  const [catalog, { refetch: refetchCatalog }] = createResource(client, async (value) => {
    const [models, integrations] = await Promise.all([value["server.model"].list(), value["server.integration"].list()])
    return { models, integrations }
  })
  const [agents] = createResource(connection, (value) =>
    apiRequest<LocationResponse<readonly AgentInfo[]>>(value, "/api/agent"),
  )
  const [selectedSession, setSelectedSession] = createSignal<string>()
  const [mode, setMode] = createSignal<"session" | "evidence">("session")
  const [mobilePanel, setMobilePanel] = createSignal<"sessions" | "context">()
  const [runtimePanel, setRuntimePanel] = createSignal<"agent" | "model" | "provider">()
  const [theme, setTheme] = createSignal<"light" | "dark">("dark")
  const [fontSize, setFontSize] = createSignal(12)
  const [alwaysApprove, setAlwaysApprove] = createSignal(false)
  const [prompt, setPrompt] = createSignal("")
  const [attachments, setAttachments] = createSignal<readonly PromptAttachment[]>([])
  const [draggingFiles, setDraggingFiles] = createSignal(false)
  const [workspacePath, setWorkspacePath] = createSignal("")
  const [draftAgent, setDraftAgent] = createSignal("operator")
  const [draftModel, setDraftModel] = createSignal("")
  const [liteLLMDialog, setLiteLLMDialog] = createSignal(false)
  const [liteLLMConfig, setLiteLLMConfig] = createSignal("~/ctf/litellm_config.yaml")
  const [pendingModel, setPendingModel] = createSignal("litellm-proxy/gpt-4o")
  const [integrationID, setIntegrationID] = createSignal("")
  const [apiKey, setApiKey] = createSignal("")
  const workspaceChoices = createMemo(() =>
    Array.from(
      new Set(
        [
          currentDirectory(),
          ...recentWorkspaces(),
          ...(workspaceSessions()?.data.map((session) => session.location.directory) ?? []),
        ].filter((directory) => directory.length > 0),
      ),
    ),
  )
  const rootSessions = createMemo(() =>
    (view()?.sessions.data ?? [])
      .filter((item) => !item.parentID && !item.time.archived && item.location.directory === currentDirectory())
      .toSorted((left, right) => right.time.updated - left.time.updated || right.time.created - left.time.created),
  )
  const sessionID = createMemo(() => {
    const selected = selectedSession()
    if (selected && view()?.sessions.data.some((item) => item.id === selected)) return selected
    return rootSessions()[0]?.id
  })
  const currentSession = createMemo(() => view()?.sessions.data.find((item) => item.id === sessionID()))
  const familyRootID = createMemo(() => currentSession()?.parentID ?? currentSession()?.id)
  const subagents = createMemo(() => {
    const rootID = familyRootID()
    if (!rootID) return []
    return view()?.sessions.data.filter((item) => item.parentID === rootID) ?? []
  })
  const [messages, { mutate: mutateMessages, refetch: refetchMessages }] = createResource(sessionID, (id) =>
    client().sessions.context({ sessionID: id }),
  )
  const pendingSource = createMemo(() => {
    const id = sessionID()
    if (!id) return
    return { connection: connection(), id }
  })
  const [pending, { mutate: mutatePending, refetch: refetchPending }] = createResource(
    pendingSource,
    async (source) => {
      const [permissions, questions] = await Promise.all([
        apiRequest<DataResponse<readonly PermissionRequest[]>>(
          source.connection,
          `/api/session/${encodeURIComponent(source.id)}/permission`,
        ),
        apiRequest<DataResponse<readonly QuestionRequest[]>>(
          source.connection,
          `/api/session/${encodeURIComponent(source.id)}/question`,
        ),
      ])
      return { permissions: permissions.data, questions: questions.data }
    },
  )
  const [liteLLM, { refetch: refetchLiteLLM }] = createResource(client, (value) => value["server.penhub"].status())
  const fileSource = createMemo(() => {
    const directory = view()?.state.location.directory
    if (!directory) return
    return { connection: connection(), directory, path: workspacePath() }
  })
  const [files] = createResource(fileSource, (source) => {
    const query = new URLSearchParams({ "location[directory]": source.directory })
    if (source.path) query.set("path", source.path)
    return apiRequest<LocationResponse<readonly FileEntry[]>>(source.connection, `/api/fs/list?${query}`)
  })
  const [activity, setActivity] = createStore<{
    busy?: "prompt" | "session" | "workspace" | "compact" | "interrupt" | "report" | "connect" | "litellm"
    error?: string
  }>({})
  let transcript: HTMLDivElement | undefined
  let attachmentInput: HTMLInputElement | undefined
  let followTranscript = true
  let transcriptSession: string | undefined
  let transcriptVersion = ""
  let streamFrame: number | undefined
  let refreshTimer: number | undefined
  let refreshRunning = false
  let refreshQueued = false
  const streamDeltas = new Map<string, { messageID: string; partID: string; delta: string }>()
  const handledPermissions = new Set<string>()
  const handledQuestions = new Set<string>()
  const [liveSessions, setLiveSessions] = createStore<Record<string, boolean>>({})

  const availableModels = createMemo(() =>
    (catalog()?.models.data ?? [])
      .filter((item) => item.enabled && item.status !== "deprecated")
      .toSorted((left, right) => `${left.providerID}/${left.name}`.localeCompare(`${right.providerID}/${right.name}`)),
  )
  const chosenModel = createMemo(() => {
    const model = currentSession()?.model
    if (model) return modelKey(model)
    return draftModel()
  })
  const chosenAgent = createMemo(() => currentSession()?.agent ?? draftAgent())
  const running = createMemo(() => Boolean(sessionID() && (view()?.active[sessionID()!] || liveSessions[sessionID()!])))
  const visiblePermission = createMemo(() => (alwaysApprove() ? undefined : pending()?.permissions[0]))
  const sortedFiles = createMemo(() =>
    (files()?.data ?? []).toSorted(
      (left, right) =>
        Number(right.type === "directory") - Number(left.type === "directory") || left.path.localeCompare(right.path),
    ),
  )
  const visibleMessages = createMemo(() => messages()?.slice(-timeline.limit))
  const hiddenMessageCount = createMemo(() => Math.max(0, (messages()?.length ?? 0) - timeline.limit))

  createEffect(() => {
    if (draftModel()) return
    if (liteLLM.loading) return
    const preferred =
      (liteLLM()?.state === "ready"
        ? availableModels().find((item) => item.providerID === "litellm-proxy" && item.id === "gpt-4o")
        : undefined) ??
      availableModels().find((item) => item.providerID === "opencode" && item.id === "hy3-free") ??
      availableModels().find((item) => item.providerID === "opencode") ??
      availableModels()[0]
    if (preferred) setDraftModel(modelKey(preferred))
  })

  createEffect(() => {
    const directory = view()?.state.location.directory
    if (!directory) return
    setRecentWorkspaces((current) => {
      const next = [directory, ...current.filter((item) => item !== directory)].slice(0, 8)
      saveRecentWorkspaces(next)
      return next
    })
  })

  const scheduleContextRefresh = () => {
    refreshQueued = true
    if (refreshTimer !== undefined || refreshRunning) return
    refreshTimer = window.setTimeout(() => {
      refreshTimer = undefined
      void flushContextRefresh()
    }, 50)
  }

  const flushContextRefresh = async () => {
    if (!sessionID()) {
      refreshQueued = false
      return
    }
    refreshRunning = true
    refreshQueued = false
    await Promise.resolve(refetchMessages()).then(
      () => undefined,
      () => undefined,
    )
    await Promise.resolve(refetchExplorer()).then(
      () => undefined,
      () => undefined,
    )
    refreshRunning = false
    if (streamDeltas.size > 0 && streamFrame === undefined) streamFrame = requestAnimationFrame(flushStreamDeltas)
    if (refreshQueued) scheduleContextRefresh()
  }

  const flushStreamDeltas = () => {
    streamFrame = undefined
    const deltas = new Map(streamDeltas)
    streamDeltas.clear()
    const applied = new Set<string>()
    const touched = new Set([...deltas.values()].map((delta) => delta.messageID))
    mutateMessages((current) =>
      current?.map((message) => {
        if (message.type !== "assistant" || !touched.has(message.id)) return message
        let changed = false
        const content = message.content.map((part) => {
          const delta = deltas.get(streamPartKey(message.id, part.id))
          if (!delta || delta.messageID !== message.id || (part.type !== "text" && part.type !== "reasoning")) {
            return part
          }
          changed = true
          applied.add(streamPartKey(message.id, part.id))
          return { ...part, text: part.text + delta.delta }
        })
        return changed ? { ...message, content } : message
      }),
    )
    for (const [key, delta] of deltas) {
      if (applied.has(key)) continue
      const next = streamDeltas.get(key)
      streamDeltas.set(key, { ...delta, delta: delta.delta + (next?.delta ?? "") })
    }
    if (streamDeltas.size > 0) scheduleContextRefresh()
  }

  const queueStreamDelta = (data: { readonly messageID: string; readonly partID: string; readonly delta: string }) => {
    const key = streamPartKey(data.messageID, data.partID)
    const current = streamDeltas.get(key)
    streamDeltas.set(key, { ...data, delta: (current?.delta ?? "") + data.delta })
    if (streamFrame !== undefined) return
    streamFrame = requestAnimationFrame(flushStreamDeltas)
  }

  const upsertAssistantPart = (messageID: string, part: AssistantContent) => {
    mutateMessages((current) =>
      current?.map((message) => {
        if (message.id !== messageID || message.type !== "assistant") return message
        const exists = message.content.some((item) => item.id === part.id)
        return {
          ...message,
          content: exists
            ? message.content.map((item) => (item.id === part.id ? part : item))
            : [...message.content, part],
        }
      }),
    )
  }

  const handleServerEvent = (event: EventsSubscribeOutput) => {
    if (event.type === "server.connected") {
      void refetch()
      if (sessionID()) {
        void refetchMessages()
        void refetchPending()
      }
      return
    }
    if (event.type === "message.part.delta") {
      if (event.data.sessionID !== sessionID() || event.data.field !== "text") return
      queueStreamDelta(event.data)
      return
    }
    if (event.type === "session.next.step.started") {
      if (event.data.sessionID !== sessionID()) return
      const data = event.data
      setLiveSessions(data.sessionID, true)
      mutateMessages((current) => {
        const exists = current?.some((message) => message.id === data.assistantMessageID)
        if (exists) return current
        const assistant: AssistantMessageInfo = {
          id: data.assistantMessageID,
          type: "assistant",
          agent: data.agent,
          model: data.model,
          time: { created: data.timestamp },
          content: [],
        }
        return [...(current ?? []), assistant]
      })
      return
    }
    if (event.type === "session.next.prompted") {
      if (event.data.sessionID !== sessionID()) return
      scheduleContextRefresh()
      return
    }
    if (event.type === "session.next.text.started") {
      if (event.data.sessionID !== sessionID()) return
      upsertAssistantPart(event.data.assistantMessageID, { type: "text", id: event.data.textID, text: "" })
      return
    }
    if (event.type === "session.next.text.delta") {
      if (event.data.sessionID !== sessionID()) return
      queueStreamDelta({
        messageID: event.data.assistantMessageID,
        partID: event.data.textID,
        delta: event.data.delta,
      })
      return
    }
    if (event.type === "session.next.text.ended") {
      if (event.data.sessionID !== sessionID()) return
      streamDeltas.delete(streamPartKey(event.data.assistantMessageID, event.data.textID))
      upsertAssistantPart(event.data.assistantMessageID, {
        type: "text",
        id: event.data.textID,
        text: event.data.text,
      })
      return
    }
    if (event.type === "session.next.reasoning.started") {
      if (event.data.sessionID !== sessionID()) return
      upsertAssistantPart(event.data.assistantMessageID, {
        type: "reasoning",
        id: event.data.reasoningID,
        text: "",
        time: { created: event.data.timestamp },
      })
      return
    }
    if (event.type === "session.next.reasoning.delta") {
      if (event.data.sessionID !== sessionID()) return
      queueStreamDelta({
        messageID: event.data.assistantMessageID,
        partID: event.data.reasoningID,
        delta: event.data.delta,
      })
      return
    }
    if (event.type === "session.next.reasoning.ended") {
      if (event.data.sessionID !== sessionID()) return
      const data = event.data
      streamDeltas.delete(streamPartKey(data.assistantMessageID, data.reasoningID))
      const assistant = messages()?.find(
        (message): message is AssistantMessageInfo =>
          message.id === data.assistantMessageID && message.type === "assistant",
      )
      const existing = assistant?.content.find((part) => part.id === data.reasoningID && part.type === "reasoning")
      upsertAssistantPart(data.assistantMessageID, {
        type: "reasoning",
        id: data.reasoningID,
        text: data.text,
        time: {
          created: existing?.type === "reasoning" ? (existing.time?.created ?? data.timestamp) : data.timestamp,
          completed: data.timestamp,
        },
      })
      return
    }
    if (event.type === "session.next.step.ended") {
      if (event.data.sessionID !== sessionID()) return
      const data = event.data
      setLiveSessions(data.sessionID, false)
      mutateMessages((current) =>
        current?.map((message) =>
          message.id === data.assistantMessageID && message.type === "assistant"
            ? {
                ...message,
                finish: data.finish,
                cost: data.cost,
                tokens: data.tokens,
                time: { ...message.time, completed: data.timestamp },
              }
            : message,
        ),
      )
      void refetch()
      return
    }
    if (event.type === "session.next.step.failed") {
      if (event.data.sessionID !== sessionID()) return
      const data = event.data
      const friendlyError = providerErrorMessage(data.error.message)
      setLiveSessions(data.sessionID, false)
      setActivity("error", friendlyError)
      mutateMessages((current) =>
        current?.map((message) =>
          message.id === data.assistantMessageID && message.type === "assistant"
            ? {
                ...message,
                finish: "error",
                error: { ...data.error, message: friendlyError },
                time: { ...message.time, completed: data.timestamp },
              }
            : message,
        ),
      )
      void refetch()
      return
    }
    if (event.type === "session.next.tool.input.delta") return
    if (event.type.startsWith("session.next.tool.")) {
      if (!("sessionID" in event.data) || event.data.sessionID !== sessionID()) return
      scheduleContextRefresh()
      return
    }
    const eventSessionID = "sessionID" in event.data ? event.data.sessionID : undefined
    if (eventSessionID && eventSessionID !== sessionID()) return
    if (event.type === "message.updated") {
      const info = event.data.info
      if (info.role !== "assistant") {
        scheduleContextRefresh()
        return
      }
      mutateMessages((current) => {
        const existing = current?.find((message) => message.id === info.id)
        const assistant = {
          ...(existing?.type === "assistant" ? existing : {}),
          id: info.id,
          time: info.time,
          type: "assistant" as const,
          agent: info.agent,
          model: { id: info.modelID, providerID: info.providerID, variant: info.variant },
          content: existing?.type === "assistant" ? existing.content : [],
          finish: info.finish,
          cost: info.cost,
          tokens: {
            input: info.tokens.input,
            output: info.tokens.output,
            reasoning: info.tokens.reasoning,
            cache: info.tokens.cache,
          },
        }
        if (!current) return [assistant]
        if (!existing) return [...current, assistant]
        return current.map((message) => (message.id === info.id ? assistant : message))
      })
      return
    }
    if (event.type === "message.part.updated") {
      const part = event.data.part
      if (part.type !== "text" && part.type !== "reasoning") {
        scheduleContextRefresh()
        return
      }
      streamDeltas.delete(streamPartKey(part.messageID, part.id))
      let applied = false
      mutateMessages((current) =>
        current?.map((message) => {
          if (message.id !== part.messageID || message.type !== "assistant") return message
          applied = true
          const contentPart =
            part.type === "text"
              ? { type: "text" as const, id: part.id, text: part.text }
              : {
                  type: "reasoning" as const,
                  id: part.id,
                  text: part.text,
                  time: { created: part.time.start, completed: part.time.end },
                }
          const exists = message.content.some((item) => item.id === part.id)
          return {
            ...message,
            content: exists
              ? message.content.map((item) => (item.id === part.id ? contentPart : item))
              : [...message.content, contentPart],
          }
        }),
      )
      if (!applied) scheduleContextRefresh()
      return
    }
    if (event.type === "message.removed" || event.type === "message.part.removed") {
      scheduleContextRefresh()
      return
    }
    if (event.type === "permission.v2.asked") {
      if (alwaysApprove()) {
        void replyPermission(event.data, "once").catch((error) => setActivity("error", errorMessage(error)))
        return
      }
      mutatePending((current) => ({
        permissions: [...(current?.permissions.filter((request) => request.id !== event.data.id) ?? []), event.data],
        questions: current?.questions ?? [],
      }))
      return
    }
    if (event.type === "permission.v2.replied") {
      mutatePending((current) =>
        current
          ? { ...current, permissions: current.permissions.filter((request) => request.id !== event.data.requestID) }
          : current,
      )
      return
    }
    if (event.type === "question.v2.asked") {
      mutatePending((current) => ({
        permissions: current?.permissions ?? [],
        questions: [...(current?.questions.filter((request) => request.id !== event.data.id) ?? []), event.data],
      }))
      return
    }
    if (event.type === "question.v2.replied" || event.type === "question.v2.rejected") {
      mutatePending((current) =>
        current
          ? { ...current, questions: current.questions.filter((request) => request.id !== event.data.requestID) }
          : current,
      )
      return
    }
    if (event.type.startsWith("session.")) void refetch()
  }

  createEffect(() => {
    const current = sessionID()
    const nextVersion = transcriptContentVersion(messages())
    const sessionChanged = current !== transcriptSession
    const contentChanged = nextVersion !== transcriptVersion
    if (sessionChanged) {
      transcriptSession = current
      followTranscript = true
      streamDeltas.clear()
      setTimeline("limit", transcriptFull ? Number.MAX_SAFE_INTEGER : 80)
    }
    transcriptVersion = nextVersion
    if (!sessionChanged && !contentChanged) return
    queueMicrotask(() => {
      if (!transcript || !followTranscript) return
      transcript.scrollTo({ top: transcript.scrollHeight })
    })
  })

  onMount(() => {
    setAlwaysApprove(localStorage.getItem("penhub.always-approve") === "true")
    const resizeText = (delta: number) => setFontSize((value) => Math.max(12, Math.min(21, value + delta)))
    const fontZoom = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      if (event.detail === "reset") {
        setFontSize(12)
        return
      }
      resizeText(event.detail === "out" ? -1 : 1)
    }
    const keydown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      if (!["+", "=", "-", "0"].includes(event.key)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.key === "0") {
        setFontSize(12)
        return
      }
      resizeText(event.key === "-" ? -1 : 1)
    }
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      event.stopImmediatePropagation()
      resizeText(event.deltaY > 0 ? -1 : 1)
    }
    window.addEventListener("penhub:font-zoom", fontZoom)
    window.addEventListener("keydown", keydown, true)
    window.addEventListener("wheel", wheel, { capture: true, passive: false })
    window.dispatchEvent(new Event("penhub:activated"))
    onCleanup(() => {
      if (streamFrame !== undefined) cancelAnimationFrame(streamFrame)
      if (refreshTimer !== undefined) clearTimeout(refreshTimer)
      window.removeEventListener("penhub:font-zoom", fontZoom)
      window.removeEventListener("keydown", keydown, true)
      window.removeEventListener("wheel", wheel, true)
    })
  })

  createEffect(() => {
    const eventClient = client()
    const events = new AbortController()
    let reconnect: number | undefined
    const subscribe = () => {
      void consumeEvents(eventClient, events.signal, handleServerEvent)
        .then(() => {
          if (!events.signal.aborted) reconnect = window.setTimeout(subscribe, 750)
        })
        .catch(() => {
          if (!events.signal.aborted) reconnect = window.setTimeout(subscribe, 750)
        })
    }
    subscribe()
    onCleanup(() => {
      events.abort()
      if (reconnect !== undefined) clearTimeout(reconnect)
    })
  })

  const runAction = async (
    busy: NonNullable<typeof activity.busy>,
    action: () => Promise<unknown>,
    refreshMessages = false,
  ) => {
    setActivity({ busy, error: undefined })
    try {
      await action()
      await refetch()
      if (refreshMessages && sessionID()) {
        await Promise.all([refetchMessages(), Promise.resolve(refetchExplorer())])
      }
    } catch (error) {
      setActivity("error", errorMessage(error))
    } finally {
      setActivity("busy", undefined)
    }
  }

  const sessionLocation = () => {
    const location = view()?.state.location
    if (!location) return
    return { directory: location.directory, workspaceID: location.workspaceID }
  }

  const createSession = async () => {
    if (activity.busy) return
    await runAction("session", async () => {
      const created = await client().sessions.create({
        agent: chosenAgent(),
        model: parseModel(chosenModel()),
        location: sessionLocation(),
      })
      setSelectedSession(created.id)
      setMainTab("session")
      setMobilePanel()
    })
  }

  const deleteSession = async (sessionID: string) => {
    if (activity.busy) return
    if (!window.confirm("Delete this session and its PenHub artifacts and logs? This cannot be undone.")) return
    await runAction("session", async () => {
      await client().sessions.remove({ sessionID })
      if (selectedSession() === sessionID) setSelectedSession()
    })
  }

  const openWorkspaceDialog = () => {
    setWorkspaceInput(currentDirectory())
    setWorkspaceDialog(true)
  }

  const switchWorkspace = async (value = workspaceInput()) => {
    const directory = normalizeWorkspaceDirectory(value)
    if (!directory) {
      setActivity("error", "Enter an absolute workspace path.")
      return
    }
    if (directory === currentDirectory()) {
      setWorkspaceDialog(false)
      return
    }
    setActivity({ busy: "workspace", error: undefined })
    try {
      const nextConnection = connectionAtWorkspace(baseConnection(), directory)
      const nextClient = OpenCode.make({ baseUrl: nextConnection.url, headers: nextConnection.headers })
      const nextView = await loadPenHubState(nextClient)
      batch(() => {
        setWorkspaceDirectory(directory)
        mutateView(nextView)
        setSelectedSession(nextView.sessions.data.find((item) => !item.parentID && !item.time.archived)?.id)
        setWorkspacePath("")
        setWorkspaceDialog(false)
        setMobilePanel()
      })
      const params = new URLSearchParams(window.location.search)
      params.set("workspace", directory)
      window.history.replaceState({}, "", `${window.location.pathname}?${params}${window.location.hash}`)
    } catch (error) {
      setActivity("error", `Cannot open workspace: ${errorMessage(error)}`)
    } finally {
      setActivity("busy", undefined)
    }
  }

  const submitPrompt = async () => {
    const text = prompt().trim()
    const files = attachments()
    if ((!text && files.length === 0) || activity.busy) return
    followTranscript = true
    await runAction(
      "prompt",
      async () => {
        const model = parseModel(chosenModel())
        const existing = sessionID()
        const id =
          existing ??
          (
            await client().sessions.create({
              agent: chosenAgent(),
              model,
              location: sessionLocation(),
            })
          ).id
        setSelectedSession(id)
        if (existing && currentSession()?.agent !== chosenAgent()) {
          await client().sessions.switchAgent({ sessionID: id, agent: chosenAgent() })
        }
        if (existing && model && modelKey(currentSession()?.model) !== chosenModel()) {
          await client().sessions.switchModel({ sessionID: id, model })
        }
        await client().sessions.prompt({
          sessionID: id,
          prompt: {
            text,
            files: files.map((file) => ({ uri: file.uri, name: file.name })),
          },
        })
        setPrompt("")
        setAttachments([])
      },
      true,
    )
  }

  const addAttachments = async (files: readonly File[]) => {
    const loaded = (
      await Promise.all(
        files.map(async (file) => {
          const mime = await attachmentMime(file)
          if (!mime) return
          const uri = await attachmentDataURL(file, mime)
          if (!uri) return
          return { id: String(crypto.randomUUID()), name: file.name, mime, uri } satisfies PromptAttachment
        }),
      )
    ).flatMap((file) => (file ? [file] : []))
    if (loaded.length === 0 && files.length > 0) {
      setActivity("error", "Unsupported attachment. Use an image, PDF, source file, or text file.")
      return
    }
    setAttachments((current) => [...current, ...loaded])
  }

  const attachWorkspaceFile = async (path: string) => {
    const directory = view()?.state.location.directory
    if (!directory) return
    const file = await readWorkspaceFile(connection(), directory, path)
    await addAttachments([file])
  }

  const switchAgent = async (agent: string) => {
    setDraftAgent(agent)
    const id = sessionID()
    if (!id) return
    await runAction("prompt", () => client().sessions.switchAgent({ sessionID: id, agent }), true)
  }

  const switchModel = async (key: string) => {
    setDraftModel(key)
    const id = sessionID()
    const model = parseModel(key)
    if (!id || !model) return
    await runAction("prompt", () => client().sessions.switchModel({ sessionID: id, model }), true)
  }

  const selectModel = (key: string) => {
    if (!key.startsWith("litellm-proxy/")) {
      void switchModel(key)
      return
    }
    setPendingModel(key)
    setLiteLLMDialog(true)
  }

  const startLiteLLM = async () => {
    const key = pendingModel()
    await runAction(
      "litellm",
      async () => {
        const result = await client()["server.penhub"].start({ configPath: liteLLMConfig() })
        if (result.state !== "ready") throw new Error(result.message ?? "LiteLLM did not become ready.")
        setDraftModel(key)
        const id = sessionID()
        const model = parseModel(key)
        if (id && model) await client().sessions.switchModel({ sessionID: id, model })
        await refetchLiteLLM()
        if (id) await refetchMessages()
        setLiteLLMDialog(false)
      },
      true,
    )
    await refetchLiteLLM()
  }

  const stopLiteLLM = async () => {
    await runAction("litellm", () => client()["server.penhub"].stop())
    await refetchLiteLLM()
  }

  async function replyPermission(request: PermissionRequest, reply: "once" | "always" | "reject") {
    if (handledPermissions.has(request.id)) return
    handledPermissions.add(request.id)
    const failure = await apiRequest(
      connection(),
      `/api/session/${encodeURIComponent(request.sessionID)}/permission/${encodeURIComponent(request.id)}/reply`,
      { method: "POST", body: JSON.stringify({ reply }) },
    ).then(
      () => undefined,
      (error: unknown) => error,
    )
    if (!failure || isServerError(failure, "PermissionNotFoundError", request.id)) {
      mutatePending((current) =>
        current ? { ...current, permissions: current.permissions.filter((item) => item.id !== request.id) } : current,
      )
      if (sessionID() === request.sessionID) await refetchPending()
      return
    }
    handledPermissions.delete(request.id)
    if (sessionID() === request.sessionID) await refetchPending()
    throw failure
  }

  createEffect(() => {
    if (!alwaysApprove()) return
    const request = pending()?.permissions[0]
    if (!request) return
    void replyPermission(request, "once").catch((error) => setActivity("error", errorMessage(error)))
  })

  const toggleAlwaysApprove = () => {
    const next = !alwaysApprove()
    setAlwaysApprove(next)
    localStorage.setItem("penhub.always-approve", String(next))
  }

  const replyQuestion = async (request: QuestionRequest, answers?: readonly (readonly string[])[]) => {
    if (handledQuestions.has(request.id)) return
    handledQuestions.add(request.id)
    const path = `/api/session/${encodeURIComponent(request.sessionID)}/question/${encodeURIComponent(request.id)}`
    const failure = await apiRequest(connection(), answers ? `${path}/reply` : `${path}/reject`, {
      method: "POST",
      body: answers ? JSON.stringify({ answers }) : undefined,
    }).then(
      () => undefined,
      (error: unknown) => error,
    )
    if (!failure || isServerError(failure, "QuestionNotFoundError", request.id)) {
      mutatePending((current) =>
        current ? { ...current, questions: current.questions.filter((item) => item.id !== request.id) } : current,
      )
      if (sessionID() === request.sessionID) await refetchPending()
      return
    }
    handledQuestions.delete(request.id)
    if (sessionID() === request.sessionID) await refetchPending()
    throw failure
  }

  const connectProvider = async () => {
    if (!integrationID() || !apiKey().trim()) return
    await runAction("connect", async () => {
      await client()["server.integration"].key({ integrationID: integrationID(), key: apiKey().trim() })
      setApiKey("")
      await refetchCatalog()
    })
  }

  const setArtifactViewerPath = (next: ArtifactViewerState | undefined) => {
    const params = new URLSearchParams(window.location.search)
    if (next) {
      params.set("artifact", next.path)
      params.set("artifactMode", next.mode)
      params.set("artifactOffset", String(next.offset))
      params.set("artifactLimit", String(next.limit))
      if (next.pattern) params.set("artifactPattern", next.pattern)
      else params.delete("artifactPattern")
      const workspace = currentDirectory()
      if (workspace) params.set("workspace", workspace)
    } else {
      params.delete("artifact")
      params.delete("artifactMode")
      params.delete("artifactOffset")
      params.delete("artifactLimit")
      params.delete("artifactPattern")
    }
    setArtifactViewer(next)
    const href = `${window.location.pathname}${params.size ? `?${params}` : ""}`
    window.history.replaceState({}, "", href)
  }

  const openArtifactTab = (path: string, mode: ArtifactReadMode = "tail") => {
    const next: ArtifactViewerState = {
      path,
      mode,
      offset: 0,
      limit: 250,
    }
    const params = new URLSearchParams(window.location.search)
    params.set("workspace", currentDirectory())
    params.set("artifact", path)
    params.set("artifactMode", next.mode)
    params.set("artifactOffset", "0")
    params.set("artifactLimit", String(next.limit))
    const target = `${window.location.origin}${window.location.pathname}?${params}`
    window.open(target, "_blank")
  }

  const openTranscriptTab = () => {
    const params = new URLSearchParams(window.location.search)
    params.set("transcript", "full")
    const target = `${window.location.origin}${window.location.pathname}?${params}`
    window.open(target, "_blank")
  }

  const activeArtifactViewer = artifactViewer()
  if (activeArtifactViewer) {
    return <ArtifactExplorer connection={connection()} viewer={activeArtifactViewer} onClose={setArtifactViewerPath} />
  }

  return (
    <main class="penhub" data-theme={theme()} style={{ "--ph-font-size": `${fontSize()}px` }}>
      <div class="flex h-full w-full bg-[var(--ph-panel)]">
        <div class="flex min-w-0 flex-1 flex-col">
          <header class="flex h-11 shrink-0 items-center border-b border-[var(--ph-line)] px-2 sm:px-4">
            <div class="hidden min-w-0 flex-1 items-center gap-3 sm:flex">
              <div class="flex shrink-0 items-center gap-2" aria-label="PenHub">
                <span class="grid size-6 place-items-center rounded-md border border-[var(--ph-line)] bg-[#090b0d]">
                  <img src="/penhub-icon.png" alt="" class="size-4 [image-rendering:pixelated]" />
                </span>
                <strong class="text-[12px] font-bold tracking-[0.08em]">
                  PEN<span class="text-[var(--ph-signal)]">/</span>HUB
                </strong>
              </div>
              <span class="h-4 w-px bg-[var(--ph-line)]" />
              <button
                type="button"
                class="group flex min-w-0 items-center gap-2 text-[11px] text-[var(--ph-muted)] hover:text-[var(--ph-ink)]"
                title="Switch workspace"
                aria-label="Switch workspace"
                onClick={openWorkspaceDialog}
              >
                <Icon name="folder" size="small" />
                <span class="truncate group-hover:text-[var(--ph-signal)]">{currentDirectory() || "Connecting"}</span>
              </button>
            </div>
            <nav class="flex h-full min-w-0 items-center gap-3 overflow-x-auto px-1 sm:px-4" aria-label="Workspace view">
              <Tab active={mainTab() === "session"} onClick={() => setMainTab("session")}>
                Session
              </Tab>
              <Tab active={mainTab() === "evidence"} onClick={() => setMainTab("evidence")}>
                Evidence
              </Tab>
              <For each={explorerTabs}>
                {(tab) => (
                  <Tab active={mainTab() === tab.value} onClick={() => setMainTab(tab.value)}>
                    {tab.label}
                  </Tab>
                )}
              </For>
            </nav>
            <div class="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 lg:hidden">
              <IconButton icon="folder" label="Switch workspace" onClick={openWorkspaceDialog} mobile />
              <IconButton icon="layout-left" label="Sessions" onClick={() => setMobilePanel("sessions")} mobile />
              <IconButton icon="layout-right" label="Context" onClick={() => setMobilePanel("context")} mobile />
            </div>
          </header>

          <Show when={activity.error}>
            <div class="flex shrink-0 items-center gap-2 border-b border-[var(--ph-signal)] bg-[var(--ph-danger-bg)] px-4 py-2 text-[12px] text-[var(--ph-signal)]">
              <Icon name="warning" size="small" />
              <span class="min-w-0 flex-1 break-words">{activity.error}</span>
              <button class="p-1" title="Dismiss" onClick={() => setActivity("error", undefined)}>
                <Icon name="close" size="small" />
              </button>
            </div>
          </Show>

          <Show
            when={view()}
            fallback={
              <div class="grid min-h-0 flex-1 place-items-center text-[12px] text-[var(--ph-muted)]">Loading...</div>
            }
          >
            <div class="relative grid min-h-0 flex-1 lg:grid-cols-[238px_minmax(420px,1fr)]">
              <aside
                class={`${mobilePanel() === "sessions" ? "flex" : "hidden"} fixed inset-x-3 bottom-3 top-[52px] z-20 min-h-0 flex-col border border-[var(--ph-line)] bg-[var(--ph-panel)] shadow-xl lg:static lg:flex lg:border-0 lg:border-r lg:shadow-none`}
              >
                <div class="flex h-8 shrink-0 items-center justify-between border-b border-[var(--ph-line)] px-2">
                  <button
                    type="button"
                    class="grid size-6 place-items-center rounded-full bg-[var(--ph-accent-soft)] text-[var(--ph-signal)] hover:bg-[var(--ph-signal)] hover:text-white disabled:opacity-35"
                    title="New security session"
                    aria-label="New security session"
                    disabled={Boolean(activity.busy)}
                    onClick={() => void createSession()}
                  >
                    <Icon name="plus" size="small" />
                  </button>
                  <div class="flex items-center gap-2 text-[9px] text-[var(--ph-muted)]">
                    <span title="Session count">{rootSessions().length}</span>
                    <button
                      class="grid size-6 place-items-center rounded-full lg:hidden"
                      title="Close sessions"
                      onClick={() => setMobilePanel()}
                    >
                      <Icon name="close" size="small" />
                    </button>
                  </div>
                </div>
                <div class="min-h-0 flex-1 overflow-y-auto">
                  <For each={rootSessions()} fallback={<Empty label="No sessions in this workspace" compact />}>
                    {(session) => (
                      <div
                        class={`group relative min-h-14 border-b border-l-2 border-b-[var(--ph-line)] ${familyRootID() === session.id ? "border-l-[var(--ph-signal)] bg-[var(--ph-accent-soft)]" : "border-l-transparent hover:bg-[var(--ph-soft)]"}`}
                      >
                        <button
                          type="button"
                          class="min-h-14 w-full px-3 py-2 pr-9 text-left"
                          aria-current={familyRootID() === session.id ? "page" : undefined}
                          onClick={() => {
                            setSelectedSession(session.id)
                            setMobilePanel()
                          }}
                        >
                          <div class="flex items-center gap-2">
                            <span
                              class={`size-1.5 shrink-0 rounded-full ${view()?.active[session.id] || liveSessions[session.id] ? "penhub-live-dot bg-[var(--ph-success)]" : familyRootID() === session.id ? "bg-[var(--ph-signal)]" : "bg-[var(--ph-line-strong)]"}`}
                            />
                            <span class="min-w-0 flex-1 truncate text-[11px] font-medium">
                              {sessionDisplayTitle(session)}
                            </span>
                          </div>
                          <div class="mt-1 flex items-center justify-between gap-2 pl-3.5 text-[9px] text-[var(--ph-muted)]">
                            <span class="truncate">{session.agent ?? "operator"}</span>
                            <time class="shrink-0" datetime={new Date(session.time.updated).toISOString()}>
                              {formatSessionTime(session.time.updated)}
                            </time>
                          </div>
                        </button>
                        <button
                          type="button"
                          class="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-[var(--ph-muted)] opacity-0 hover:bg-[var(--ph-danger-bg)] hover:text-[var(--ph-signal)] focus:opacity-100 group-hover:opacity-100"
                          title="Delete session, artifacts, and logs"
                          aria-label={`Delete ${sessionDisplayTitle(session)}`}
                          disabled={Boolean(activity.busy)}
                          onClick={() => void deleteSession(session.id)}
                        >
                          <Icon name="trash" size="small" />
                        </button>
                      </div>
                    )}
                  </For>
                </div>
                <FileBrowser
                  entries={sortedFiles()}
                  path={workspacePath()}
                  loading={files.loading}
                  back={() => setWorkspacePath(parentPath(workspacePath()))}
                  select={(entry) => {
                    if (entry.type === "directory") {
                      setWorkspacePath(entry.path.replace(/\/$/, ""))
                      return
                    }
                    void attachWorkspaceFile(entry.path).catch((error) => setActivity("error", errorMessage(error)))
                  }}
                />
              </aside>

              <section class="flex min-h-0 min-w-0 flex-col bg-[var(--ph-panel)]">
                <div class="flex h-8 shrink-0 items-center gap-1 border-b border-[var(--ph-line)] px-2">
                  <Show when={familyRootID()} keyed>
                    {(rootID) => (
                      <button
                        class={`grid size-6 shrink-0 place-items-center rounded-full hover:bg-[var(--ph-soft)] ${sessionID() === rootID ? "bg-[var(--ph-accent-soft)] text-[var(--ph-signal)]" : "text-[var(--ph-muted)]"}`}
                        title="Primary agent"
                        aria-label="View primary agent"
                        onClick={() => setSelectedSession(rootID)}
                      >
                        <Icon name="branch" size="small" />
                      </button>
                    )}
                  </Show>
                  <div class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                    <For each={subagents()}>
                      {(agent) => (
                        <button
                          class={`flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2 text-[9px] ${sessionID() === agent.id ? "border-[var(--ph-signal)] bg-[var(--ph-accent-soft)] text-[var(--ph-signal)]" : "border-transparent text-[var(--ph-muted)] hover:bg-[var(--ph-soft)]"}`}
                          title={agent.title || `View ${subagentLabel(agent)}`}
                          onClick={() => setSelectedSession(agent.id)}
                        >
                          <span
                            class={`size-1.5 rounded-full ${view()?.active[agent.id] ? "penhub-live-dot bg-[var(--ph-success)]" : "bg-[var(--ph-tool)]"}`}
                          />
                          <span class="max-w-36 truncate">{subagentLabel(agent)}</span>
                        </button>
                      )}
                    </For>
                  </div>
                  <div class="flex shrink-0 items-center pl-1">
                    <span
                      class={`size-1.5 rounded-full ${running() ? "penhub-live-dot bg-[var(--ph-success)]" : "bg-[var(--ph-line)]"}`}
                      title={running() ? "Session running" : "Session idle"}
                      aria-label={running() ? "Session running" : "Session idle"}
                    />
                  </div>
                </div>

                <Show
                  when={mainTab() === "session"}
                  fallback={
                    <Show
                      when={mainTab() === "evidence"}
                      fallback={
                        <ExplorerContent
                          workspace={view()?.state.data.workspace}
                          explorer={explorer()}
                          activeTab={mainTab() as PenHubExplorerTab}
                          openArtifact={openArtifactTab}
                        />
                      }
                    >
                      <ExplorerEvidence workspace={view()?.state.data.workspace} explorer={explorer()} openArtifact={openArtifactTab} />
                    </Show>
                  }
                >
                  <div
                    ref={transcript}
                    class="min-h-0 flex-1 overflow-y-auto"
                    onWheel={(event) => {
                      if (event.deltaY < 0) followTranscript = false
                    }}
                    onTouchStart={() => {
                      followTranscript = false
                    }}
                    onPointerDown={(event) => {
                      if (event.clientX >= event.currentTarget.getBoundingClientRect().right - 16) {
                        followTranscript = false
                      }
                    }}
                    onScroll={(event) => {
                      const element = event.currentTarget
                      followTranscript = element.scrollHeight - element.scrollTop - element.clientHeight < 24
                    }}
                  >
                    <div class="mx-auto w-full max-w-[1280px] px-3 sm:px-4">
                    <Show when={hiddenMessageCount() > 0}>
                        <div class="mx-auto my-3 flex w-full max-w-[1280px] gap-2 px-3">
                          <button
                            type="button"
                            class="penhub-control h-8 px-3 text-[10px]"
                            onClick={() => setTimeline("limit", (limit) => limit + 80)}
                          >
                            Load {Math.min(80, hiddenMessageCount())} earlier messages
                          </button>
                          <Show when={!transcriptFull}>
                            <button
                              type="button"
                              class="penhub-control h-8 px-3 text-[10px]"
                              onClick={openTranscriptTab}
                            >
                              Open full transcript in new tab
                            </button>
                          </Show>
                        </div>
                      </Show>
                      <For each={visibleMessages()} fallback={<SessionEmpty />}>
                        {(message) => (
                          <SessionMessage
                            message={message}
                            theme={theme()}
                            fontSize={fontSize()}
                            streaming={running() && message.type === "assistant" && !message.time.completed}
                          />
                        )}
                      </For>
                    </div>
                  </div>

                  <Show when={visiblePermission()} keyed>
                    {(request) => <PermissionDock request={request} reply={replyPermission} />}
                  </Show>
                  <Show when={pending()?.questions[0]} keyed>
                    {(request) => <QuestionDock request={request} reply={replyQuestion} />}
                  </Show>

                  <form
                    class="shrink-0 border-t border-[var(--ph-line)] bg-[var(--ph-bg)] p-2.5"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void submitPrompt()
                    }}
                  >
                    <div
                      class="penhub-composer mx-auto w-full max-w-[1280px] border border-[var(--ph-line)] bg-[var(--ph-panel)] p-2"
                      classList={{ "penhub-composer-dragging": draggingFiles() }}
                      onDragOver={(event) => {
                        if (!event.dataTransfer?.types.includes("Files")) return
                        event.preventDefault()
                        setDraggingFiles(true)
                      }}
                      onDragLeave={(event) => {
                        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                        setDraggingFiles(false)
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        setDraggingFiles(false)
                        void addAttachments(Array.from(event.dataTransfer?.files ?? []))
                      }}
                    >
                      <input
                        ref={attachmentInput}
                        type="file"
                        multiple
                        accept={ACCEPTED_FILE_TYPES.join(",")}
                        class="hidden"
                        onChange={(event) => {
                          void addAttachments(Array.from(event.currentTarget.files ?? []))
                          event.currentTarget.value = ""
                        }}
                      />
                      <Show when={attachments().length > 0}>
                        <div class="mb-1.5 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto px-1 pt-0.5">
                          <For each={attachments()}>
                            {(file) => (
                              <div class="penhub-attachment group flex h-8 max-w-48 items-center gap-1.5 border border-[var(--ph-line)] bg-[var(--ph-bg)] pr-1.5">
                                <Show
                                  when={file.mime.startsWith("image/")}
                                  fallback={<Icon name="file-tree" size="small" />}
                                >
                                  <img src={file.uri} alt="" class="size-7 rounded-md object-cover" />
                                </Show>
                                <span class="min-w-0 flex-1 truncate text-[9px]" title={file.name}>
                                  {file.name}
                                </span>
                                <button
                                  type="button"
                                  class="grid size-5 shrink-0 place-items-center rounded-full text-[var(--ph-muted)] hover:bg-[var(--ph-soft)] hover:text-[var(--ph-ink)]"
                                  title={`Remove ${file.name}`}
                                  aria-label={`Remove ${file.name}`}
                                  onClick={() =>
                                    setAttachments((current) => current.filter((item) => item.id !== file.id))
                                  }
                                >
                                  <Icon name="close-small" size="small" />
                                </button>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                      <textarea
                        class="max-h-32 min-h-10 w-full resize-none bg-transparent px-1 py-0.5 text-[11px] leading-5 outline-none placeholder:text-[var(--ph-muted)]"
                        value={prompt()}
                        onInput={(event) => setPrompt(event.currentTarget.value)}
                        onPaste={(event) => {
                          const files = Array.from(event.clipboardData?.files ?? [])
                          if (files.length === 0) return
                          event.preventDefault()
                          void addAttachments(files)
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" || event.shiftKey) return
                          event.preventDefault()
                          void submitPrompt()
                        }}
                        placeholder="Target, scope, goal, and available artifacts"
                        aria-label="Security prompt"
                      />
                      <div class="mt-1 flex items-center justify-between gap-2 border-t border-[var(--ph-line)] pt-1.5">
                        <div class="flex min-w-0 items-center gap-1 overflow-x-auto">
                          <IconButton
                            icon="cloud-upload"
                            label="Attach images or files"
                            onClick={() => attachmentInput?.click()}
                          />
                          <button
                            type="button"
                            class={`penhub-control relative grid size-8 shrink-0 place-items-center rounded-full ${alwaysApprove() ? "border-[var(--ph-success)] text-[var(--ph-success)]" : "text-[var(--ph-muted)]"}`}
                            title={alwaysApprove() ? "Full permissions enabled" : "Enable full permissions"}
                            aria-label={alwaysApprove() ? "Disable full permissions" : "Enable full permissions"}
                            aria-pressed={alwaysApprove()}
                            onClick={toggleAlwaysApprove}
                          >
                            <Icon name="shield" size="small" />
                            <Show when={alwaysApprove()}>
                              <span class="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-[var(--ph-success)]" />
                            </Show>
                          </button>
                          <IconButton
                            icon="archive"
                            label="Compact context"
                            disabled={!sessionID() || Boolean(activity.busy)}
                            onClick={() => {
                              const id = sessionID()
                              if (id)
                                void runAction("compact", () => client().sessions.compact({ sessionID: id }), true)
                            }}
                          />
                          <IconButton
                            icon="eye"
                            label={theme() === "dark" ? "Use light theme" : "Use dark theme"}
                            onClick={() => setTheme(theme() === "light" ? "dark" : "light")}
                          />
                          <IconButton
                            icon="download"
                            label="Generate report"
                            disabled={activity.busy === "report" || !view()?.state.data.initialized}
                            onClick={() => void runAction("report", () => client()["server.penhub"].generate())}
                          />
                          <Show when={running()}>
                            <IconButton
                              icon="stop"
                              label="Stop response"
                              disabled={Boolean(activity.busy)}
                              onClick={() => {
                                const id = sessionID()
                                if (id)
                                  void runAction(
                                    "interrupt",
                                    () => client().sessions.interrupt({ sessionID: id }),
                                    true,
                                  )
                              }}
                            />
                          </Show>
                        </div>
                        <button
                          type="submit"
                          class="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--ph-signal)] text-white hover:brightness-110 disabled:opacity-35"
                          disabled={Boolean(activity.busy) || (!prompt().trim() && attachments().length === 0)}
                          title="Send"
                          aria-label="Send"
                        >
                          <Icon name="arrow-up" size="small" />
                        </button>
                      </div>
                    </div>
                  </form>
                </Show>
              </section>
            </div>
          </Show>
        </div>
        <Show when={view()}>
          <aside
            class={`${mobilePanel() === "context" ? "flex" : "hidden"} fixed inset-3 z-20 min-h-0 flex-col border border-[var(--ph-line)] bg-[var(--ph-panel)] shadow-xl lg:static lg:flex lg:w-[272px] lg:shrink-0 lg:border-0 lg:border-l lg:shadow-none`}
          >
            <div class="flex h-11 shrink-0 items-center gap-1 border-b border-[var(--ph-line)] px-2">
              <RuntimeControl
                icon="robot"
                label="Agent"
                active={runtimePanel() === "agent"}
                onClick={() => setRuntimePanel(runtimePanel() === "agent" ? undefined : "agent")}
              />
              <RuntimeControl
                icon="brain"
                label="Model"
                active={runtimePanel() === "model"}
                onClick={() => setRuntimePanel(runtimePanel() === "model" ? undefined : "model")}
              />
              <RuntimeControl
                icon="providers"
                label="Provider API"
                active={runtimePanel() === "provider"}
                onClick={() => setRuntimePanel(runtimePanel() === "provider" ? undefined : "provider")}
              />
              <button
                type="button"
                class="ml-auto grid size-7 place-items-center rounded-full text-[var(--ph-muted)] hover:bg-[var(--ph-soft)] hover:text-[var(--ph-ink)] lg:hidden"
                title="Close runtime"
                aria-label="Close runtime"
                onClick={() => setMobilePanel()}
              >
                <Icon name="close" size="small" />
              </button>
            </div>

            <Show when={runtimePanel()} keyed>
              {(panel) => (
                <div class="shrink-0 border-b border-[var(--ph-line)] p-3">
                  <Switch>
                    <Match when={panel === "agent"}>
                      <select
                        class="penhub-control h-9 w-full px-2 text-[11px]"
                        value={chosenAgent()}
                        aria-label="Agent"
                        onChange={(event) => void switchAgent(event.currentTarget.value)}
                      >
                        <For each={agents()?.data.filter((item) => !item.hidden)}>
                          {(agent) => <option value={agent.id}>{agent.id}</option>}
                        </For>
                      </select>
                      <p class="mt-2 text-[10px] leading-4 text-[var(--ph-muted)]">
                        {agents()?.data.find((item) => item.id === chosenAgent())?.description ?? "Security operator"}
                      </p>
                    </Match>
                    <Match when={panel === "model"}>
                      <select
                        class="penhub-control h-9 w-full px-2 text-[10px]"
                        value={chosenModel()}
                        aria-label="Model"
                        onChange={(event) => selectModel(event.currentTarget.value)}
                      >
                        <For each={availableModels()}>
                          {(model) => (
                            <option value={modelKey(model)}>
                              {model.providerID === "litellm-proxy"
                                ? "local_litellm"
                                : `${model.providerID} / ${model.name}`}
                            </option>
                          )}
                        </For>
                      </select>
                      <Show when={lastAssistantError(messages())}>
                        <p class="mt-2 text-[10px] leading-4 text-[var(--ph-signal)]">
                          Previous provider failed. New prompts use the selected model.
                        </p>
                      </Show>
                    </Match>
                    <Match when={panel === "provider"}>
                      <select
                        class="penhub-control h-9 w-full px-2 text-[11px]"
                        value={integrationID()}
                        aria-label="Provider"
                        onChange={(event) => setIntegrationID(event.currentTarget.value)}
                      >
                        <option value="">Choose provider</option>
                        <For each={keyIntegrations(catalog()?.integrations)}>
                          {(integration) => (
                            <option value={integration.id}>
                              {integration.name}
                              {integration.connections.length ? " (connected)" : ""}
                            </option>
                          )}
                        </For>
                      </select>
                      <div class="mt-2 flex gap-1">
                        <input
                          type="password"
                          class="penhub-control h-9 min-w-0 flex-1 px-2 text-[11px]"
                          value={apiKey()}
                          onInput={(event) => setApiKey(event.currentTarget.value)}
                          placeholder="API key"
                          aria-label="Provider API key"
                        />
                        <button
                          type="button"
                          class="penhub-control h-9 px-3 text-[10px] font-medium"
                          disabled={!integrationID() || !apiKey().trim() || activity.busy === "connect"}
                          onClick={() => void connectProvider()}
                        >
                          Connect
                        </button>
                      </div>
                    </Match>
                  </Switch>
                </div>
              )}
            </Show>

            <div class="min-h-0 flex-1 overflow-y-auto">
              <SideSection
                title="Tool packs"
                meta={`${view()?.tools.data.filter((item) => item.installed).length ?? 0}/6 cached`}
              >
                <For each={view()?.tools.data}>
                  {(pack) => (
                    <details class="border-b border-[var(--ph-line)] py-2 last:border-0">
                      <summary class="flex cursor-pointer list-none items-center gap-2 text-[11px] font-medium capitalize">
                        <span
                          class={`size-1.5 rounded-full ${pack.installed ? "bg-[var(--ph-success)]" : "bg-[var(--ph-tool)]"}`}
                        />
                        <span class="flex-1">{pack.id}</span>
                        <span class="text-[9px] font-normal text-[var(--ph-muted)]">
                          {pack.installed ? "cached" : "pulls on use"}
                        </span>
                      </summary>
                      <p class="mt-2 text-[10px] leading-4 text-[var(--ph-muted)]">{pack.description}</p>
                      <div class="mt-2 flex flex-wrap gap-1">
                        <For each={pack.tools}>
                          {(tool) => <code class="bg-[var(--ph-soft)] px-1.5 py-1 text-[9px]">{tool.command}</code>}
                        </For>
                      </div>
                    </details>
                  )}
                </For>
              </SideSection>
            </div>
          </aside>
        </Show>
      </div>
      <Show when={liteLLMDialog()}>
        <LiteLLMDialog
          status={liteLLM()}
          path={liteLLMConfig()}
          busy={activity.busy === "litellm"}
          error={activity.error}
          setPath={setLiteLLMConfig}
          close={() => setLiteLLMDialog(false)}
          start={() => void startLiteLLM()}
          stop={() => void stopLiteLLM()}
        />
      </Show>
      <Show when={workspaceDialog()}>
        <WorkspaceDialog
          current={currentDirectory()}
          choices={workspaceChoices()}
          input={workspaceInput()}
          busy={activity.busy === "workspace"}
          setInput={setWorkspaceInput}
          close={() => setWorkspaceDialog(false)}
          choose={(directory) => void switchWorkspace(directory)}
          submit={() => void switchWorkspace()}
        />
      </Show>
    </main>
  )
}

function IconButton(props: {
  icon: Parameters<typeof Icon>[0]["name"]
  label: string
  onClick: () => void
  disabled?: boolean
  mobile?: boolean
}) {
  return (
    <button
      type="button"
      class={`penhub-control grid size-8 place-items-center rounded-full disabled:opacity-35 ${props.mobile ? "lg:hidden" : ""}`}
      disabled={props.disabled}
      onClick={props.onClick}
      title={props.label}
      aria-label={props.label}
    >
      <Icon name={props.icon} size="small" />
    </button>
  )
}

function RuntimeControl(props: {
  icon: Parameters<typeof Icon>[0]["name"]
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      class={`grid size-8 shrink-0 place-items-center rounded-full border ${props.active ? "border-[var(--ph-signal)] bg-[var(--ph-accent-soft)] text-[var(--ph-signal)]" : "border-transparent text-[var(--ph-muted)] hover:bg-[var(--ph-soft)] hover:text-[var(--ph-ink)]"}`}
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.active}
      onClick={props.onClick}
    >
      <Icon name={props.icon} size="small" />
    </button>
  )
}

function WorkspaceDialog(props: {
  current: string
  choices: readonly string[]
  input: string
  busy: boolean
  setInput: (value: string) => void
  close: () => void
  choose: (directory: string) => void
  submit: () => void
}) {
  return (
    <div
      class="penhub-modal fixed inset-0 z-50 grid place-items-center p-4"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === "Escape") props.close()
      }}
    >
      <section
        class="w-full max-w-[560px] overflow-hidden rounded-lg border border-[var(--ph-line-strong)] bg-[var(--ph-panel)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-title"
      >
        <header class="flex h-10 items-center gap-2 border-b border-[var(--ph-line)] px-3">
          <span class="text-[var(--ph-signal)]">
            <Icon name="folder" size="small" />
          </span>
          <h2 id="workspace-title" class="text-[11px] font-bold">
            Switch workspace
          </h2>
          <button
            type="button"
            class="ml-auto grid size-7 place-items-center rounded-full text-[var(--ph-muted)] hover:bg-[var(--ph-soft)] hover:text-[var(--ph-ink)]"
            title="Close"
            aria-label="Close workspace switcher"
            onClick={props.close}
          >
            <Icon name="close" size="small" />
          </button>
        </header>
        <div class="max-h-64 overflow-y-auto p-2">
          <For each={props.choices} fallback={<Empty label="No recent workspaces" compact />}>
            {(directory) => (
              <button
                type="button"
                class={`flex h-10 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-[var(--ph-soft)] ${directory === props.current ? "bg-[var(--ph-accent-soft)] text-[var(--ph-signal)]" : "text-[var(--ph-ink)]"}`}
                disabled={props.busy}
                onClick={() => props.choose(directory)}
              >
                <span
                  class={`size-1.5 shrink-0 rounded-full ${directory === props.current ? "bg-[var(--ph-signal)]" : "bg-[var(--ph-line-strong)]"}`}
                />
                <span class="min-w-0 flex-1 truncate text-[10px]">{directory}</span>
                <Show when={directory === props.current}>
                  <span class="text-[8px] font-bold uppercase">current</span>
                </Show>
              </button>
            )}
          </For>
        </div>
        <form
          class="flex gap-2 border-t border-[var(--ph-line)] bg-[var(--ph-bg)] p-3"
          onSubmit={(event) => {
            event.preventDefault()
            props.submit()
          }}
        >
          <input
            class="penhub-control h-9 min-w-0 flex-1 px-3 text-[10px]"
            value={props.input}
            onInput={(event) => props.setInput(event.currentTarget.value)}
            placeholder="/absolute/path/to/workspace"
            aria-label="Workspace directory"
            autocomplete="off"
            spellcheck={false}
            autofocus
          />
          <button
            type="submit"
            class="h-9 rounded-md bg-[var(--ph-signal)] px-4 text-[9px] font-bold text-white disabled:opacity-35"
            disabled={props.busy || !props.input.trim()}
          >
            {props.busy ? "Opening..." : "Open"}
          </button>
        </form>
      </section>
    </div>
  )
}

function LiteLLMDialog(props: {
  status?: ServerPenhubStatusOutput
  path: string
  busy: boolean
  error?: string
  setPath: (value: string) => void
  close: () => void
  start: () => void
  stop: () => void
}) {
  return (
    <div class="penhub-modal fixed inset-0 z-50 grid place-items-center p-4" role="presentation">
      <section
        class="w-full max-w-[520px] rounded-lg border border-[var(--ph-line-strong)] bg-[var(--ph-panel)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="litellm-title"
      >
        <header class="flex h-10 items-center justify-between border-b border-[var(--ph-line)] px-3">
          <div class="flex items-center gap-2">
            <span
              class={`size-1.5 rounded-full ${props.status?.state === "ready" ? "bg-[var(--ph-success)]" : "bg-[var(--ph-signal)]"}`}
            />
            <h2 id="litellm-title" class="text-[11px] font-bold">
              custom_litellm
            </h2>
          </div>
          <button
            class="grid size-7 place-items-center text-[var(--ph-muted)] hover:text-[var(--ph-ink)]"
            title="Close"
            onClick={props.close}
          >
            <Icon name="close" size="small" />
          </button>
        </header>
        <div class="p-4">
          <label for="litellm-config" class="mb-2 block text-[9px] font-bold uppercase text-[var(--ph-muted)]">
            LiteLLM YAML path
          </label>
          <input
            id="litellm-config"
            class="penhub-control h-9 w-full px-3 text-[11px]"
            value={props.path}
            onInput={(event) => props.setPath(event.currentTarget.value)}
            placeholder="~/path/to/litellm_config.yaml"
            autocomplete="off"
            spellcheck={false}
          />
          <dl class="mt-4 grid grid-cols-[92px_minmax(0,1fr)] border-y border-[var(--ph-line)] py-2 text-[9px] leading-5">
            <dt class="text-[var(--ph-muted)]">STATUS</dt>
            <dd>{props.status?.state ?? "checking"}</dd>
            <dt class="text-[var(--ph-muted)]">ENDPOINT</dt>
            <dd class="truncate">{props.status?.baseURL ?? "http://127.0.0.1:4000/v1"}</dd>
            <dt class="text-[var(--ph-muted)]">EXECUTABLE</dt>
            <dd class="truncate">{props.status?.executable ?? "not found"}</dd>
          </dl>
          <Show when={props.error ?? props.status?.message} keyed>
            {(message) => (
              <pre class="mt-3 max-h-36 overflow-auto whitespace-pre-wrap border-l-2 border-[var(--ph-signal)] bg-[var(--ph-danger-bg)] px-3 py-2 text-[9px] leading-4 text-[var(--ph-signal)]">
                {message}
              </pre>
            )}
          </Show>
        </div>
        <footer class="flex items-center justify-between border-t border-[var(--ph-line)] px-4 py-3">
          <button
            class="penhub-control h-8 px-3 text-[9px] disabled:opacity-35"
            disabled={props.busy || props.status?.state !== "ready"}
            onClick={props.stop}
          >
            Stop
          </button>
          <div class="flex gap-1">
            <button class="penhub-control h-8 px-3 text-[9px]" disabled={props.busy} onClick={props.close}>
              Cancel
            </button>
            <button
              class="h-8 bg-[var(--ph-signal)] px-4 text-[9px] font-bold text-white disabled:opacity-35"
              disabled={props.busy || !props.path.trim()}
              onClick={props.start}
            >
              {props.busy ? "Starting..." : props.status?.state === "ready" ? "Use model" : "Start LiteLLM"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

function SideSection(props: { title: string; meta?: string; children: JSX.Element }) {
  return (
    <section class="border-b border-[var(--ph-line)] p-3">
      <div class="mb-2 flex items-center justify-between gap-2">
        <h3 class="text-[10px] font-bold uppercase">{props.title}</h3>
        <span class="text-[9px] text-[var(--ph-muted)]">{props.meta}</span>
      </div>
      {props.children}
    </section>
  )
}

function Tab(props: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      class={`penhub-tab h-full border-b text-[9px] font-bold uppercase ${props.active ? "border-[var(--ph-signal)] text-[var(--ph-ink)]" : "border-transparent text-[var(--ph-muted)]"}`}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

function FileBrowser(props: {
  entries: readonly FileEntry[]
  path: string
  loading: boolean
  back: () => void
  select: (entry: FileEntry) => void
}) {
  return (
    <section class="flex min-h-[120px] max-h-[34%] shrink-0 flex-col border-t border-[var(--ph-line)]">
      <div class="flex h-8 shrink-0 items-center gap-1 border-b border-[var(--ph-line)] px-2">
        <button
          class="grid size-6 shrink-0 place-items-center rounded-full text-[var(--ph-muted)] hover:bg-[var(--ph-soft)] hover:text-[var(--ph-ink)] disabled:opacity-30"
          title="Parent directory"
          aria-label="Parent directory"
          disabled={!props.path}
          onClick={props.back}
        >
          <Icon name="chevron-left" size="small" />
        </button>
        <Icon name="folder" size="small" />
        <span class="min-w-0 flex-1 truncate text-[9px] text-[var(--ph-muted)]" title={props.path || "Workspace root"}>
          {props.path ? fileName(props.path) : "workspace"}
        </span>
        <Show when={props.loading}>
          <span class="penhub-live-dot size-1.5 rounded-full bg-[var(--ph-success)]" title="Loading files" />
        </Show>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto py-1">
        <For each={props.entries} fallback={<Empty label="No files" compact />}>
          {(entry) => (
            <button
              class="flex h-7 w-full items-center gap-2 px-3 text-left text-[10px] text-[var(--ph-muted)] hover:bg-[var(--ph-soft)] hover:text-[var(--ph-ink)]"
              title={entry.type === "directory" ? `Open ${entry.path}` : `Attach ${entry.path} to prompt`}
              onClick={() => props.select(entry)}
            >
              <Icon name={entry.type === "directory" ? "folder" : "file-tree"} size="small" />
              <span class="min-w-0 flex-1 truncate">{fileName(entry.path)}</span>
            </button>
          )}
        </For>
      </div>
    </section>
  )
}

type ExplorerPayload = PenHubExplorerPayload
type ArtifactItem = {
  path: string
  kind: string
  source: string
}
const explorerTabs: readonly {
  value: PenHubExplorerTab
  label: string
}[] = [
  { value: "overview", label: "Overview" },
  { value: "state-card", label: "State" },
  { value: "facts", label: "Facts" },
  { value: "hypotheses", label: "Hypotheses" },
  { value: "branches", label: "Branches" },
  { value: "attempts", label: "Attempts" },
  { value: "lessons", label: "Lessons" },
  { value: "findings", label: "Findings" },
  { value: "artifacts", label: "Artifacts" },
]

function ExplorerContent(props: {
  workspace: PenHubWorkspaceInfo | undefined
  explorer: PenHubExplorerPayload | undefined
  activeTab: PenHubExplorerTab
  openArtifact: (path: string, mode?: ArtifactReadMode) => void
}) {
  return (
    <section class="min-h-0 flex-1 overflow-y-auto bg-[var(--ph-panel)]">
      <Show when={props.explorer?.initialized} fallback={<Empty label="No live PenHub payload yet" compact />}>
        <Switch>
          <Match when={props.activeTab === "overview"}>
            <ExplorerOverview workspace={props.workspace} explorer={props.explorer} />
          </Match>
          <Match when={props.activeTab === "state-card"}>
            <ExplorerStateCard explorer={props.explorer} />
          </Match>
          <Match when={props.activeTab === "facts"}>
            <ExplorerFacts workspace={props.workspace} />
          </Match>
          <Match when={props.activeTab === "hypotheses"}>
            <ExplorerHypotheses workspace={props.workspace} />
          </Match>
          <Match when={props.activeTab === "branches"}>
            <ExplorerBranches workspace={props.workspace} run={props.explorer?.run} />
          </Match>
          <Match when={props.activeTab === "attempts"}>
            <ExplorerAttempts explorer={props.explorer} openArtifact={props.openArtifact} />
          </Match>
          <Match when={props.activeTab === "lessons"}>
            <ExplorerLessons explorer={props.explorer} />
          </Match>
          <Match when={props.activeTab === "findings"}>
            <ExplorerFindings explorer={props.explorer} openArtifact={props.openArtifact} />
          </Match>
          <Match when={props.activeTab === "artifacts"}>
            <ExplorerArtifacts workspace={props.workspace} explorer={props.explorer} openArtifact={props.openArtifact} />
          </Match>
        </Switch>
      </Show>
    </section>
  )
}

function ExplorerOverview(props: { workspace?: PenHubWorkspaceInfo; explorer?: PenHubExplorerPayload }) {
  const labels = () => {
    const workspace = props.workspace
    const run = props.explorer?.run
    return {
      facts: workspace?.facts.length ?? 0,
      hypotheses: workspace?.hypotheses.length ?? 0,
      branches: workspace?.branches.length ?? 0,
      evidence: workspace?.evidence.length ?? 0,
      attempts: props.explorer?.attempts.length ?? 0,
      lessons: props.explorer?.lessons.length ?? 0,
      findings: props.explorer?.findings.length ?? 0,
      run: run ? `${run.status} / ${run.phase}` : "no active run",
    }
  }

  return (
    <div class="px-3 py-2">
      <Show
        when={props.workspace}
        fallback={<p class="py-8 text-center text-[10px] text-[var(--ph-muted)]">Initialize a challenge to view details.</p>}
      >
        {(workspace) => (
          <>
            <div class="mb-2 border-b border-[var(--ph-line)] pb-2">
              <h4 class="text-[12px] font-semibold">{workspace().challenge.name}</h4>
              <p class="mt-1 text-[10px] leading-4 text-[var(--ph-muted)]">{workspace().challenge.goal}</p>
              <p class="mt-1 text-[9px] text-[var(--ph-muted)]">Type: {workspace().challenge.type}</p>
            </div>
            <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
              <dt class="text-[var(--ph-muted)]">Facts</dt>
              <dd>{labels().facts}</dd>
              <dt class="text-[var(--ph-muted)]">Hypotheses</dt>
              <dd>{labels().hypotheses}</dd>
              <dt class="text-[var(--ph-muted)]">Branches</dt>
              <dd>{labels().branches}</dd>
              <dt class="text-[var(--ph-muted)]">Evidence</dt>
              <dd>{labels().evidence}</dd>
              <dt class="text-[var(--ph-muted)]">Attempts</dt>
              <dd>{labels().attempts}</dd>
              <dt class="text-[var(--ph-muted)]">Lessons</dt>
              <dd>{labels().lessons}</dd>
              <dt class="text-[var(--ph-muted)]">Findings</dt>
              <dd>{labels().findings}</dd>
              <dt class="text-[var(--ph-muted)]">Run</dt>
              <dd>{labels().run}</dd>
            </dl>
            <Show when={workspace().tokenUsage?.totalTokens ?? 0}>
              {(tokens) => <p class="mt-2 border-t border-[var(--ph-line)] pt-2 text-[9px] text-[var(--ph-muted)]">Tokens: {tokens()}</p>}
            </Show>
          </>
        )}
      </Show>
    </div>
  )
}

function asNumber(value: number | string | undefined) {
  const next = Number(value)
  return Number.isFinite(next) ? next : 0
}

function ExplorerStateCard(props: { explorer?: ExplorerPayload }) {
  return (
    <div class="px-3 py-2">
      <p class="mb-2 text-[9px] uppercase text-[var(--ph-muted)]">Current compact state card</p>
      <PenHubMarkdown
        text={props.explorer?.stateCard ?? "No state card available yet."}
        cacheKey="state-card"
        theme="dark"
        fontSize={11}
        streaming={false}
      />
    </div>
  )
}

function ExplorerFacts(props: { workspace?: PenHubWorkspaceInfo }) {
  const facts = () => props.workspace?.facts ?? []
  return (
    <div class="px-3 py-2">
      <Show
        when={facts().length}
        fallback={<p class="py-8 text-center text-[10px] text-[var(--ph-muted)]">No facts recorded yet.</p>}
      >
        <For each={facts()}>
          {(fact) => (
            <article class="mb-2 border-l-2 border-[var(--ph-line)] pl-2">
              <div class="text-[11px] leading-5">{fact.claim}</div>
              <div class="mt-1 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-[9px] text-[var(--ph-muted)]">
                <span>{fact.source}</span>
                <span>{Math.round(asNumber(fact.confidence) * 100)}%</span>
                <span>{fact.id}</span>
              </div>
            </article>
          )}
        </For>
      </Show>
    </div>
  )
}

function ExplorerHypotheses(props: { workspace?: PenHubWorkspaceInfo }) {
  const hypotheses = () => props.workspace?.hypotheses ?? []
  return (
    <div class="px-3 py-2">
      <Show
        when={hypotheses().length}
        fallback={<p class="py-8 text-center text-[10px] text-[var(--ph-muted)]">No hypotheses proposed yet.</p>}
      >
        <For each={hypotheses()}>
          {(hypothesis) => (
            <article class="mb-3 border-b border-[var(--ph-line)] pb-2 last:mb-0 last:border-b-0 last:pb-0">
              <div class="flex flex-wrap items-center gap-1">
                <span class={`px-1.5 py-0.5 text-[8px] uppercase ${statusPill(hypothesis.status)}`}>{hypothesis.status}</span>
                <span class="text-[9px] text-[var(--ph-muted)]">id:{hypothesis.id}</span>
                <span class="ml-auto text-[9px] text-[var(--ph-muted)]">{Math.round(asNumber(hypothesis.confidence) * 100)}%</span>
              </div>
              <p class="mt-1 text-[11px] leading-5">{hypothesis.claim}</p>
              <Show when={hypothesis.nextTest}>
                <p class="mt-1 text-[10px] leading-4 text-[var(--ph-muted)]">Next: {hypothesis.nextTest}</p>
              </Show>
              <Show when={hypothesis.requiredEvidence.length}>
                <p class="mt-1 text-[9px] text-[var(--ph-muted)]">
                  Supports: {hypothesis.requiredEvidence.join(", ")}
                </p>
              </Show>
            </article>
          )}
        </For>
      </Show>
    </div>
  )
}

type ExplorerBranchRow = {
  id: string
  status: string
  confidence: number
  progress: number
  novelty: number
  attempts: number
  goal: string
  evidenceIds: readonly string[]
  updatedAt: string
}

function ExplorerBranches(props: { workspace?: PenHubWorkspaceInfo; run?: ExplorerRunState }) {
  const rows = () => {
    const branches = props.run?.branches ?? props.workspace?.branches ?? []
    return branches.map((branch) => {
      const runBranch = branch as ExplorerRunBranch
      return {
        id: branch.id,
        status: branch.status,
        confidence: asNumber(runBranch.confidence),
        progress: asNumber(runBranch.progress),
        novelty: asNumber(runBranch.novelty),
        attempts: runBranch.attempts ?? 0,
        goal: runBranch.goal ?? runBranch.claim ?? "",
        evidenceIds: runBranch.evidenceIds,
        updatedAt: branch.updatedAt,
      } satisfies ExplorerBranchRow
    })
  }
  const orderedBranches = () =>
    [...rows()].toSorted((left, right) => {
      const rank = { queued: 0, active: 1, supported: 2, open: 3, confirmed: 4, refuted: 5, failed: 6, stale: 7, blocked: 8 }
      const leftRank = rank[left.status as keyof typeof rank] ?? 99
      const rightRank = rank[right.status as keyof typeof rank] ?? 99
      if (leftRank !== rightRank) return leftRank - rightRank
      return right.updatedAt.localeCompare(left.updatedAt)
    })

  return (
    <div class="px-3 py-2">
      <Show
        when={orderedBranches().length}
        fallback={<p class="py-8 text-center text-[10px] text-[var(--ph-muted)]">No branches yet.</p>}
      >
        <For each={orderedBranches()}>
          {(branch, index) => {
            const hasChildren = index() < orderedBranches().length - 1
            return (
              <div class="relative border-l border-[var(--ph-line)] pl-3 py-2 last:border-l-0">
                <span
                  class={`absolute left-[-3px] top-5 h-2 w-2 rounded-full ${
                    branch.status === "active" || branch.status === "supported" || branch.status === "queued"
                      ? "bg-[var(--ph-signal)]"
                      : "bg-[var(--ph-muted)]"
                  }`}
                />
                <Show when={index() !== 0}>
                  <span class="absolute left-[-3px] top-0 h-3 border-l-2 border-[var(--ph-line)]" />
                </Show>
                <Show when={hasChildren}>
                  <span class="absolute left-[-3px] top-5 h-3 border-l border-[var(--ph-line)]" />
                </Show>
                <div class="text-[11px] leading-5">
                  <div class="flex items-center gap-2">
                    <span class={`text-[9px] uppercase ${statusPill(branch.status)}`}>{branch.status}</span>
                    <span class="truncate">{branch.id}</span>
                    <span class="ml-auto text-[9px] text-[var(--ph-muted)]">{Math.round(branch.confidence * 100)}%</span>
                  </div>
                  <p class="mt-1 text-[11px] text-[var(--ph-ink)]">{branch.goal}</p>
                  <p class="mt-1 text-[9px] text-[var(--ph-muted)]">Novelty: {branch.novelty.toFixed(2)}</p>
                </div>
                <div class="mt-1 h-1.5 overflow-hidden rounded-sm bg-[var(--ph-soft)]">
                  <div
                    class="h-full bg-[var(--ph-signal)]"
                    style={{ width: `${Math.max(0, Math.min(100, branch.progress * 100))}%` }}
                  />
                </div>
                <div class="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[9px] text-[var(--ph-muted)]">
                  <span>Attempts: {branch.attempts}</span>
                  <span>Evidence: {branch.evidenceIds.length}</span>
                  <span>Refl: {branch.novelty.toFixed(2)}</span>
                </div>
              </div>
            )
          }}
        </For>
      </Show>
    </div>
  )
}

function ExplorerAttempts(props: { explorer?: ExplorerPayload; openArtifact: (path: string, mode?: ArtifactReadMode) => void }) {
  const attempts = () => props.explorer?.attempts ?? []
  return (
    <div class="px-3 py-2">
      <Show
        when={attempts().length}
        fallback={<p class="py-8 text-center text-[10px] text-[var(--ph-muted)]">No tool attempts yet.</p>}
      >
        <For each={attempts()}>
          {(attempt) => (
            <article class="mb-3 border-b border-[var(--ph-line)] pb-2 last:mb-0 last:border-b-0 last:pb-0">
              <div class="flex items-center gap-2">
                <span class={`px-1.5 py-0.5 text-[8px] uppercase ${statusPill(attempt.status)}`}>{attempt.status}</span>
                <span class="truncate text-[11px]">{attempt.tool}</span>
                <span class="ml-auto text-[9px] text-[var(--ph-muted)]">{attempt.id}</span>
              </div>
              <p class="mt-1 text-[10px] text-[var(--ph-muted)]">{attempt.observation}</p>
              <div class="mt-1 text-[9px] text-[var(--ph-muted)]">
                <span>Branch: {attempt.branchId ?? "unscoped"}</span>
                <Show when={attempt.artifactPath}>
                  <button
                    type="button"
                    class="ml-2 underline"
                    title={`Open ${attempt.artifactPath}`}
                    onClick={() => props.openArtifact(attempt.artifactPath ?? "", "tail")}
                  >
                    Open artifact
                  </button>
                </Show>
              </div>
            </article>
          )}
        </For>
      </Show>
    </div>
  )
}

function ExplorerLessons(props: { explorer?: ExplorerPayload }) {
  const lessons = () => props.explorer?.lessons ?? []
  return (
    <div class="px-3 py-2">
      <Show
        when={lessons().length}
        fallback={<p class="py-8 text-center text-[10px] text-[var(--ph-muted)]">No lessons yet.</p>}
      >
        <For each={lessons()}>
          {(lesson) => (
            <article class="mb-3 border-b border-[var(--ph-line)] pb-2 last:mb-0 last:border-b-0 last:pb-0">
              <p class="text-[11px] leading-5">{lesson.failedAssumption}</p>
              <p class="mt-1 text-[10px] text-[var(--ph-muted)]">Next: {lesson.nextTest}</p>
              <p class="mt-1 text-[9px] text-[var(--ph-muted)]">Avoid: {lesson.avoid}</p>
              <p class="mt-1 text-[9px] text-[var(--ph-muted)]">Observed attempts: {lesson.attemptIds.join(", ") || "none"}</p>
            </article>
          )}
        </For>
      </Show>
    </div>
  )
}

function ExplorerFindings(props: { explorer?: ExplorerPayload; openArtifact: (path: string, mode?: ArtifactReadMode) => void }) {
  const findings = () => props.explorer?.findings ?? []
  return (
    <div class="px-3 py-2">
      <Show
        when={findings().length}
        fallback={<p class="py-8 text-center text-[10px] text-[var(--ph-muted)]">No verified findings yet.</p>}
      >
        <For each={findings()}>
          {(finding) => (
            <article class="mb-3 border-b border-[var(--ph-line)] pb-2 last:mb-0 last:border-b-0 last:pb-0">
              <p class="text-[11px] leading-5">{finding.claim}</p>
              <div class="mt-1 text-[10px] text-[var(--ph-muted)]">Candidate: {finding.candidate}</div>
              <div class="mt-1 text-[9px] text-[var(--ph-muted)]">Method: {finding.verificationMethod}</div>
              <Show when={finding.artifactPaths.length > 0}>
                <div class="mt-2 flex flex-wrap gap-2">
                  <For each={finding.artifactPaths}>
                    {(path) => (
                      <button
                        type="button"
                        class="underline text-[9px]"
                        title={`Open ${path}`}
                        onClick={() => props.openArtifact(path, "tail")}
                      >
                        {path}
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </article>
          )}
        </For>
      </Show>
    </div>
  )
}

function ExplorerArtifacts(props: {
  workspace?: PenHubWorkspaceInfo
  explorer?: ExplorerPayload
  openArtifact: (path: string, mode?: ArtifactReadMode) => void
}) {
  const artifacts = () => collectArtifacts(props.workspace, props.explorer)
  return (
    <div class="px-3 py-2">
      <Show
        when={artifacts().length}
        fallback={<p class="py-8 text-center text-[10px] text-[var(--ph-muted)]">No artifacts recorded yet.</p>}
      >
        <For each={artifacts()}>
          {(artifact) => (
            <button
              type="button"
              class="mb-2 w-full rounded border border-[var(--ph-line)] px-2 py-1.5 text-left text-[10px] hover:bg-[var(--ph-soft)]"
              onClick={() => props.openArtifact(artifact.path, "tail")}
            >
              <div class="flex gap-2 text-[9px] text-[var(--ph-muted)]">
                <span>{artifact.kind}</span>
                <span>·</span>
                <span>{artifact.source}</span>
              </div>
              <p class="mt-1 truncate font-semibold">{artifact.path}</p>
            </button>
          )}
        </For>
      </Show>
    </div>
  )
}

function ExplorerEvidence(props: { workspace?: PenHubWorkspaceInfo; explorer?: ExplorerPayload; openArtifact: (path: string, mode?: ArtifactReadMode) => void }) {
  return (
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-[820px] px-4 sm:px-7">
        <Show
          when={props.workspace}
          fallback={<Empty label="No workspace state initialized." />}
        >
          <div class="space-y-3 py-2">
            <ExplorerOverview workspace={props.workspace} explorer={props.explorer} />
            <div class="border-t border-[var(--ph-line)] pt-3" />
            <ExplorerFacts workspace={props.workspace} />
            <div class="border-t border-[var(--ph-line)] pt-3" />
            <ExplorerHypotheses workspace={props.workspace} />
            <div class="border-t border-[var(--ph-line)] pt-3" />
            <ExplorerBranches workspace={props.workspace} />
            <div class="border-t border-[var(--ph-line)] pt-3" />
            <ExplorerFindings explorer={props.explorer} openArtifact={props.openArtifact} />
            <div class="border-t border-[var(--ph-line)] pt-3" />
            <ExplorerArtifacts workspace={props.workspace} explorer={props.explorer} openArtifact={props.openArtifact} />
          </div>
        </Show>
      </div>
    </div>
  )
}

function statusPill(status: string) {
  if (status === "active" || status === "confirmed" || status === "queued" || status === "supported" || status === "success")
    return "bg-[var(--ph-accent-soft)] text-[var(--ph-ink)]"
  if (
    status === "error" ||
    status === "failed" ||
    status === "rejected" ||
    status === "blocked" ||
    status === "refuted"
  )
    return "bg-[var(--ph-danger-bg)] text-[var(--ph-signal)]"
  if (status === "open" || status === "testing" || status === "reflect") return "bg-[var(--ph-soft)] text-[var(--ph-muted)]"
  return "bg-[var(--ph-soft)] text-[var(--ph-muted)]"
}

function collectArtifacts(workspace: PenHubWorkspaceInfo | undefined, explorer?: ExplorerPayload): ArtifactItem[] {
  const paths = new Map<string, ArtifactItem>()

  for (const evidence of workspace?.evidence ?? []) {
    if (!evidence.artifactPath) continue
    paths.set(evidence.artifactPath, { path: evidence.artifactPath, kind: evidence.type, source: "evidence" })
  }
  for (const attempt of explorer?.attempts ?? []) {
    if (!attempt.artifactPath) continue
    paths.set(attempt.artifactPath, { path: attempt.artifactPath, kind: "tool-run", source: "attempt" })
  }
  for (const lesson of explorer?.lessons ?? []) {
    for (const attemptID of lesson.attemptIds) {
      const attempt = explorer?.attempts.find((item) => item.id === attemptID)
      if (attempt?.artifactPath) {
        paths.set(attempt.artifactPath, { path: attempt.artifactPath, kind: "lesson", source: "lesson" })
      }
    }
  }
  for (const finding of explorer?.findings ?? []) {
    for (const path of finding.artifactPaths) {
      paths.set(path, { path, kind: "finding", source: "verified-finding" })
    }
  }
  return [...paths.values()].sort((left, right) => left.path.localeCompare(right.path))
}

function ArtifactExplorer(props: { connection: Connection; viewer: ArtifactViewerState; onClose: (next?: ArtifactViewerState) => void }) {
  const [viewer, setViewer] = createStore({
    path: props.viewer.path,
    mode: props.viewer.mode,
    offset: props.viewer.offset,
    limit: props.viewer.limit,
    pattern: props.viewer.pattern ?? "",
  })
  const hasPattern = () => viewer.mode === "grep"
  const offset = () => viewer.offset
  const limit = () => viewer.limit
  const [artifactState, { refetch: refetchArtifact }] = createResource(
    () => ({ path: viewer.path, mode: viewer.mode, offset: viewer.offset, limit: viewer.limit, pattern: viewer.pattern }),
    (input) =>
      readArtifact(props.connection, {
        path: input.path,
        mode: input.mode,
        offset: input.offset,
        limit: input.limit,
        pattern: input.pattern || undefined,
      }),
  )
  const artifact = () => artifactState()

  createEffect(() => {
    setViewer("path", props.viewer.path)
    setViewer("mode", props.viewer.mode)
    setViewer("offset", props.viewer.offset)
    setViewer("limit", props.viewer.limit)
    setViewer("pattern", props.viewer.pattern ?? "")
  })

  const pageBack = () => {
    const nextOffset = Math.max(0, offset() - limit())
    setViewer("offset", nextOffset)
    void refetchArtifact()
    props.onClose({ ...viewer, offset: nextOffset, pattern: viewer.pattern || undefined })
  }
  const pageForward = () => {
    const total = artifact()?.totalLines ?? 0
    const nextOffset = Math.min(offset() + limit(), Math.max(0, total - limit()))
    setViewer("offset", nextOffset)
    void refetchArtifact()
    props.onClose({ ...viewer, offset: nextOffset, pattern: viewer.pattern || undefined })
  }
  const mode = () => viewer.mode
  const canForward = () => offset() + limit() < (artifact()?.totalLines ?? 0)
  const canBack = () => offset() > 0

  const applyPattern = (pattern: string) => {
    setViewer("pattern", pattern)
    if (mode() === "grep") void refetchArtifact()
  }

  const applyMode = (next: ArtifactReadMode) => {
    setViewer("mode", next)
    setViewer("offset", 0)
    void refetchArtifact()
    props.onClose({ ...viewer, mode: next, offset: 0 })
  }

  const applyLimit = (value: string) => {
    const parsed = Number.parseInt(value)
    if (!Number.isFinite(parsed)) return
    const next = Math.max(1, Math.min(500, parsed))
    setViewer("limit", next)
    setViewer("offset", 0)
    void refetchArtifact()
    props.onClose({ ...viewer, limit: next, offset: 0 })
  }

  const applyOffset = (value: string) => {
    const parsed = Number.parseInt(value)
    if (!Number.isFinite(parsed)) return
    setViewer("offset", Math.max(0, parsed))
    void refetchArtifact()
    props.onClose({ ...viewer, offset: Math.max(0, parsed) })
  }

  return (
    <section class="penhub h-dvh">
      <div class="mx-auto flex h-full max-w-[1280px] flex-col">
        <header class="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--ph-line)] px-3">
          <h1 class="text-[11px] font-bold">Artifact Explorer</h1>
          <button
            type="button"
            class="ml-auto penhub-control grid size-8 shrink-0 place-items-center rounded-full"
            title="Close"
            onClick={() => props.onClose()}
          >
            <Icon name="close" size="small" />
          </button>
        </header>
        <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3">
          <div class="mb-2 grid gap-2 text-[10px] sm:grid-cols-[minmax(0,1fr)_max-content_max-content]">
            <input
              class="penhub-control h-8 min-w-0 px-2"
              value={viewer.path}
              onInput={(event) => setViewer("path", event.currentTarget.value)}
              placeholder="Artifact path"
            />
            <select
              class="penhub-control h-8 px-2"
              value={mode()}
              onChange={(event) => applyMode(event.currentTarget.value as ArtifactReadMode)}
            >
              <option value="tail">tail</option>
              <option value="head">head</option>
              <option value="lines">lines</option>
              <option value="grep">grep</option>
            </select>
              <button class="penhub-control h-8 px-2" onClick={() => void refetchArtifact()}>
              Reload
            </button>
          </div>
          <div class="mb-2 grid gap-2 text-[10px] sm:grid-cols-[minmax(0,1fr)_minmax(0,100px)_minmax(0,100px)]">
            <Show when={hasPattern()}>
              <input
                class="penhub-control h-8 px-2"
                value={viewer.pattern}
                placeholder="grep pattern (regex)"
                onInput={(event) => applyPattern(event.currentTarget.value)}
              />
            </Show>
            <Show when={!hasPattern()}>
              <span class="h-8" />
            </Show>
            <label class="inline-flex items-center gap-1 border border-[var(--ph-line)] px-2">
              <span class="text-[9px] text-[var(--ph-muted)]">Limit</span>
              <input
                class="h-8 min-w-0 bg-transparent text-right text-[10px] outline-none"
                value={limit()}
                type="number"
                min="1"
                max="500"
                onInput={(event) => applyLimit(event.currentTarget.value)}
              />
            </label>
            <label class="inline-flex items-center gap-1 border border-[var(--ph-line)] px-2">
              <span class="text-[9px] text-[var(--ph-muted)]">Offset</span>
              <input
                class="h-8 min-w-0 bg-transparent text-right text-[10px] outline-none"
                value={offset()}
                type="number"
                min="0"
                onInput={(event) => applyOffset(event.currentTarget.value)}
              />
            </label>
          </div>
          <Show when={artifact()} keyed>
            {(entry) => (
              <div class="mb-2 flex flex-wrap items-center gap-2 text-[9px] text-[var(--ph-muted)]">
                <span>{entry.mode} mode</span>
                <span>offset {offset()}</span>
                <span>returned {entry.returnedLines}</span>
                <span>total {entry.totalLines}</span>
                <Show when={entry.truncated}>
                  <span>truncated</span>
                </Show>
              </div>
            )}
          </Show>
          <div class="mb-2 flex gap-2">
            <button
              type="button"
              class="penhub-control h-7 px-2 text-[9px] disabled:opacity-40"
              disabled={!canBack()}
              onClick={pageBack}
            >
              Back
            </button>
            <button
              type="button"
              class="penhub-control h-7 px-2 text-[9px] disabled:opacity-40"
              disabled={!canForward()}
              onClick={pageForward}
            >
              Forward
            </button>
          </div>
          <Show when={artifact()} fallback={<Empty label="No artifact content" compact />} keyed>
            {(entry) => (
              <pre class="min-h-0 flex-1 overflow-auto rounded border border-[var(--ph-line)] bg-[var(--ph-bg)] p-2 text-[10px] leading-4">
                {entry.output}
              </pre>
            )}
          </Show>
        </div>
      </div>
    </section>
  )
}
function SessionEmpty() {
  return (
    <div class="grid min-h-[320px] place-items-center py-12 text-center">
      <div>
        <div class="mx-auto mb-4 h-1 w-10 bg-[var(--ph-signal)]" />
        <h2 class="text-[13px] font-semibold">Start with scope and evidence</h2>
        <p class="mt-2 max-w-sm text-[11px] leading-5 text-[var(--ph-muted)]">
          The operator records attack state, runs security tools, and keeps raw output in workspace artifacts.
        </p>
      </div>
    </div>
  )
}

function SessionMessage(props: {
  message: SessionMessageInfo
  theme: "light" | "dark"
  fontSize: number
  streaming: boolean
}) {
  return (
    <article class="border-b border-[var(--ph-line)] py-3.5 last:border-0">
      <div class="min-w-0">
        <Switch>
          <Match when={props.message.type === "user" && props.message}>
            {(message) => (
              <div>
                <Show when={message().text}>
                  <p class="whitespace-pre-wrap text-[12px] leading-5">{message().text}</p>
                </Show>
                <MessageAttachments files={message().files} />
              </div>
            )}
          </Match>
          <Match when={props.message.type === "assistant" && props.message}>
            {(message) => (
              <div class="space-y-3">
                <div class="flex flex-wrap items-center gap-x-2 text-[9px] uppercase text-[var(--ph-muted)]">
                  <span class="size-1.5 rounded-full bg-[var(--ph-tool)]" title="Assistant" />
                  <span>{message().agent}</span>
                  <span>
                    {message().model.providerID}:{message().model.id}
                  </span>
                </div>
                <Show when={message().error} keyed>
                  {(error) => (
                    <div class="border-l-2 border-[var(--ph-signal)] bg-[var(--ph-danger-bg)] px-3 py-2 text-[12px] leading-5 text-[var(--ph-signal)]">
                      <strong class="block text-[10px] uppercase">Provider error</strong>
                      {providerErrorMessage(error.message)}
                    </div>
                  )}
                </Show>
                <For each={message().content}>
                  {(part) => (
                    <Switch>
                      <Match when={part.type === "text" && part}>
                        {(item) => (
                          <PenHubMarkdown
                            text={item().text}
                            cacheKey={item().id}
                            theme={props.theme}
                            fontSize={props.fontSize}
                            streaming={props.streaming}
                          />
                        )}
                      </Match>
                      <Match when={part.type === "reasoning" && part}>
                        {(item) => (
                          <ReasoningPart
                            id={item().id}
                            text={item().text}
                            theme={props.theme}
                            fontSize={props.fontSize}
                            streaming={props.streaming}
                          />
                        )}
                      </Match>
                      <Match when={part.type === "tool" && part}>
                        {(item) => <ToolCall name={item().name} state={item().state} />}
                      </Match>
                    </Switch>
                  )}
                </For>
              </div>
            )}
          </Match>
          <Match when={props.message.type === "shell" && props.message}>
            {(message) => (
              <div class="border border-[var(--ph-line)] bg-[var(--ph-bg)] p-3">
                <code class="text-[11px]">$ {message().command}</code>
                <pre class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-[var(--ph-muted)]">
                  {message().output}
                </pre>
              </div>
            )}
          </Match>
          <Match when={(props.message.type === "system" || props.message.type === "synthetic") && props.message}>
            {(message) => (
              <p class="whitespace-pre-wrap text-[11px] leading-5 text-[var(--ph-muted)]">{message().text}</p>
            )}
          </Match>
          <Match when={props.message.type === "compaction" && props.message}>
            {(message) => (
              <p class="whitespace-pre-wrap text-[11px] leading-5 text-[var(--ph-muted)]">{message().summary}</p>
            )}
          </Match>
          <Match when={props.message.type === "agent-switched" && props.message}>
            {(message) => <p class="text-[11px] text-[var(--ph-muted)]">Agent changed to {message().agent}</p>}
          </Match>
          <Match when={props.message.type === "model-switched" && props.message}>
            {(message) => (
              <p class="text-[11px] text-[var(--ph-muted)]">Model changed to {modelKey(message().model)}</p>
            )}
          </Match>
        </Switch>
      </div>
    </article>
  )
}

function ReasoningPart(props: {
  id: string
  text: string
  theme: "light" | "dark"
  fontSize: number
  streaming: boolean
}) {
  const [state, setState] = createStore({ open: props.streaming })
  let wasStreaming = props.streaming

  createEffect(() => {
    const streaming = props.streaming
    if (streaming) setState("open", true)
    if (!streaming && wasStreaming) setState("open", false)
    wasStreaming = streaming
  })

  return (
    <details
      class="border-l-2 border-[var(--ph-line)] pl-3"
      open={state.open}
      onToggle={(event) => setState("open", event.currentTarget.open)}
    >
      <summary class="cursor-pointer text-[9px] font-bold uppercase text-[var(--ph-muted)]">Thinking</summary>
      <Show when={state.open}>
        <Show
          when={!props.streaming}
          fallback={
            <pre class="max-h-56 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-[var(--ph-muted)]">
              {props.text.slice(-6000)}
            </pre>
          }
        >
          <PenHubMarkdown
            text={props.text}
            cacheKey={props.id}
            theme={props.theme}
            fontSize={props.fontSize}
            streaming={false}
          />
        </Show>
      </Show>
    </details>
  )
}

function MessageAttachments(props: { files?: readonly MessageFile[] }) {
  return (
    <Show when={props.files?.length}>
      <div class="mt-2 flex flex-wrap gap-2">
        <For each={props.files}>
          {(file) => (
            <Show
              when={file.mime.startsWith("image/")}
              fallback={
                <a
                  class="penhub-message-file flex h-8 max-w-56 items-center gap-2 border border-[var(--ph-line)] bg-[var(--ph-bg)] px-2 text-[9px]"
                  href={file.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={file.name ?? file.uri}
                >
                  <Icon name="file-tree" size="small" />
                  <span class="truncate">{file.name ?? "attachment"}</span>
                </a>
              }
            >
              <a href={file.uri} target="_blank" rel="noopener noreferrer" title={file.name ?? "Open image"}>
                <img
                  class="max-h-56 max-w-full rounded-lg border border-[var(--ph-line)] object-contain"
                  src={file.uri}
                  alt={file.name ?? "Attached image"}
                />
              </a>
            </Show>
          )}
        </For>
      </div>
    </Show>
  )
}

function ToolCall(props: { name: string; state: ToolState }) {
  const [details, setDetails] = createStore({ open: props.state.status === "error" })
  createEffect(() => {
    if (props.state.status === "error") setDetails("open", true)
  })
  const output = () => {
    if (props.state.status === "pending") return
    const text = props.state.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n")
    if (text) return text
    if (props.state.status === "error") return props.state.error.message
    if (props.state.status === "completed" && props.state.result !== undefined) {
      return formatUnknown(props.state.result)
    }
  }
  return (
    <details
      class="border border-[var(--ph-line)] bg-[var(--ph-bg)]"
      open={details.open}
      onToggle={(event) => setDetails("open", event.currentTarget.open)}
    >
      <summary class="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
        <Icon name="terminal" size="small" />
        <code class="min-w-0 flex-1 truncate text-[11px] font-semibold">{props.name}</code>
        <Status value={props.state.status} />
      </summary>
      <Show when={details.open}>
        <div class="border-t border-[var(--ph-line)] p-3">
          <pre class="max-h-40 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-4 text-[var(--ph-muted)]">
            {formatUnknown(props.state.input)}
          </pre>
          <Show when={output()} keyed>
            {(value) => (
              <pre class="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words border-t border-[var(--ph-line)] pt-3 text-[10px] leading-4">
                {value}
              </pre>
            )}
          </Show>
        </div>
      </Show>
    </details>
  )
}

function PermissionDock(props: {
  request: PermissionRequest
  reply: (request: PermissionRequest, reply: "once" | "always" | "reject") => Promise<void>
}) {
  const [replying, setReplying] = createSignal<"once" | "always" | "reject">()
  const [failure, setFailure] = createSignal<string>()
  const reply = async (value: "once" | "always" | "reject") => {
    if (replying()) return
    setReplying(value)
    setFailure()
    const error = await props.reply(props.request, value).then(
      () => undefined,
      (error: unknown) => error,
    )
    setReplying()
    if (error) setFailure(errorMessage(error))
  }
  return (
    <div class="shrink-0 border-t border-[var(--ph-signal)] bg-[var(--ph-danger-bg)] px-3 py-2.5 sm:px-4">
      <div class="mx-auto flex max-w-[1280px] flex-wrap items-center gap-2">
        <Icon name="shield" size="small" />
        <div class="min-w-0 flex-1 basis-[180px]">
          <div class="text-[11px] font-semibold">Permission: {props.request.action}</div>
          <div class="break-all text-[9px] text-[var(--ph-muted)]">{props.request.resources.join(", ")}</div>
        </div>
        <div class="ml-auto flex shrink-0 gap-2">
          <button
            type="button"
            class="penhub-control grid size-8 shrink-0 place-items-center rounded-full text-[var(--ph-signal)]"
            title="Deny"
            aria-label="Deny permission"
            disabled={Boolean(replying())}
            onClick={() => void reply("reject")}
          >
            <Icon name="circle-x" size="small" />
          </button>
          <button
            type="button"
            class="penhub-control grid size-8 shrink-0 place-items-center rounded-full"
            title="Allow always"
            aria-label="Always allow this permission"
            disabled={Boolean(replying())}
            onClick={() => void reply("always")}
          >
            <Icon name="shield" size="small" />
          </button>
          <button
            type="button"
            class="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--ph-ink)] text-[var(--ph-panel)]"
            title="Allow once"
            aria-label="Allow permission once"
            disabled={Boolean(replying())}
            onClick={() => void reply("once")}
          >
            <Icon name="check" size="small" />
          </button>
        </div>
        <Show when={failure()} keyed>
          {(message) => <div class="basis-full break-words text-[10px] text-[var(--ph-signal)]">{message}</div>}
        </Show>
      </div>
    </div>
  )
}

function QuestionDock(props: {
  request: QuestionRequest
  reply: (request: QuestionRequest, answers?: readonly (readonly string[])[]) => Promise<void>
}) {
  const [answers, setAnswers] = createStore<Record<string, string[]>>({})
  const [replying, setReplying] = createSignal(false)
  const [failure, setFailure] = createSignal<string>()
  const reply = async (answers?: readonly (readonly string[])[]) => {
    if (replying()) return
    setReplying(true)
    setFailure()
    const error = await props.reply(props.request, answers).then(
      () => undefined,
      (error: unknown) => error,
    )
    setReplying(false)
    if (error) setFailure(errorMessage(error))
  }
  return (
    <div class="max-h-[42vh] shrink-0 overflow-y-auto border-t border-[var(--ph-signal)] bg-[var(--ph-bg)] px-4 py-3">
      <div class="mx-auto max-w-[820px]">
        <For each={props.request.questions}>
          {(question, index) => (
            <fieldset class="mb-3 last:mb-0">
              <legend class="text-[11px] font-semibold">
                {question.header}: {question.question}
              </legend>
              <div class="mt-2 flex flex-wrap gap-1">
                <For each={question.options}>
                  {(option) => {
                    const selected = () => (answers[String(index())] ?? []).includes(option.label)
                    return (
                      <button
                        type="button"
                        class={`border px-2 py-1.5 text-left text-[10px] ${selected() ? "border-[var(--ph-ink)] bg-[var(--ph-ink)] text-[var(--ph-panel)]" : "border-[var(--ph-line)] bg-[var(--ph-panel)]"}`}
                        title={option.description}
                        onClick={() => {
                          const values = answers[String(index())] ?? []
                          setAnswers(
                            String(index()),
                            question.multiple
                              ? selected()
                                ? values.filter((item) => item !== option.label)
                                : [...values, option.label]
                              : [option.label],
                          )
                        }}
                      >
                        {option.label}
                      </button>
                    )
                  }}
                </For>
              </div>
              <Show when={question.custom !== false}>
                <input
                  class="penhub-control mt-2 h-8 w-full px-2 text-[10px]"
                  placeholder="Custom answer"
                  onInput={(event) =>
                    setAnswers(String(index()), event.currentTarget.value ? [event.currentTarget.value] : [])
                  }
                />
              </Show>
            </fieldset>
          )}
        </For>
        <div class="mt-3 flex justify-end gap-1 border-t border-[var(--ph-line)] pt-3">
          <button
            type="button"
            class="penhub-control h-8 px-3 text-[10px]"
            disabled={replying()}
            onClick={() => void reply()}
          >
            Reject
          </button>
          <button
            type="button"
            class="h-8 bg-[var(--ph-ink)] px-3 text-[10px] text-[var(--ph-panel)]"
            disabled={replying()}
            onClick={() => void reply(props.request.questions.map((_, index) => answers[String(index)] ?? []))}
          >
            Submit answers
          </button>
        </div>
        <Show when={failure()} keyed>
          {(message) => <div class="mt-2 break-words text-[10px] text-[var(--ph-signal)]">{message}</div>}
        </Show>
      </div>
    </div>
  )
}

function Evidence(props: { workspace: PenHubWorkspaceInfo }) {
  const events = () =>
    [
      ...(props.workspace?.facts ?? []).map((item) => ({
        id: item.id,
        time: item.createdAt,
        kind: "fact",
        title: item.claim,
        detail: `${Math.round(Number(item.confidence) * 100)}% confidence`,
      })),
      ...(props.workspace?.evidence ?? []).map((item) => ({
        id: item.id,
        time: item.createdAt,
        kind: item.type,
        title: item.summary,
        detail: item.artifactPath ?? item.supports.join(", "),
      })),
      ...(props.workspace?.failedAttempts ?? []).map((item) => ({
        id: item.id,
        time: item.createdAt,
        kind: "failed",
        title: item.summary,
        detail: item.reason,
      })),
    ].toSorted((left, right) => left.time.localeCompare(right.time))

  return (
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-[820px] px-4 sm:px-7">
        <For each={events()} fallback={<Empty label="No recorded evidence" />}>
          {(event) => (
            <article class="grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-b border-[var(--ph-line)] py-4 sm:grid-cols-[82px_minmax(0,1fr)]">
              <div class="text-[9px] font-bold uppercase text-[var(--ph-muted)]">{event.kind}</div>
              <div>
                <h3 class="text-[12px] font-medium leading-5">{event.title}</h3>
                <Show when={event.detail}>
                  <p class="mt-1 break-words font-mono text-[10px] leading-4 text-[var(--ph-muted)]">{event.detail}</p>
                </Show>
              </div>
            </article>
          )}
        </For>
      </div>
    </div>
  )
}

function Empty(props: { label: string; compact?: boolean }) {
  return (
    <p class={`${props.compact ? "py-5" : "py-12"} text-center text-[10px] text-[var(--ph-muted)]`}>{props.label}</p>
  )
}

function Status(props: { value: string }) {
  return (
    <span class="bg-[var(--ph-soft)] px-1.5 py-0.5 text-[9px] uppercase text-[var(--ph-muted)]">{props.value}</span>
  )
}

function keyIntegrations(integrations?: ServerIntegrationListOutput) {
  return integrations?.data.filter((item) => item.methods.some((method) => method.type === "key")) ?? []
}

function connectionAtWorkspace(connection: Connection, directory: string): Connection {
  if (!directory) return connection
  const headers = new Headers(connection.headers)
  headers.set("x-opencode-directory", encodeURIComponent(directory))
  return { url: connection.url, headers }
}

function normalizeWorkspaceDirectory(value: string) {
  const trimmed = value.trim()
  if (!trimmed.startsWith("/")) return
  return trimmed === "/" ? trimmed : trimmed.replace(/\/+$/, "")
}

function loadRecentWorkspaces() {
  if (typeof window === "undefined") return []
  const value = localStorage.getItem("penhub.recent-workspaces")
  if (!value) return []
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed)) return []
  return parsed.filter((item): item is string => typeof item === "string" && item.startsWith("/")).slice(0, 8)
}

function saveRecentWorkspaces(workspaces: readonly string[]) {
  localStorage.setItem("penhub.recent-workspaces", JSON.stringify(workspaces))
}

function sessionDisplayTitle(session: SessionListInfo) {
  const title = session.title.trim()
  if (!title || /^new session(?:\s+-\s+.*)?$/i.test(title)) return "New security session"
  return title
}

function formatSessionTime(timestamp: number) {
  const elapsed = Math.max(0, Date.now() - timestamp)
  if (elapsed < 60_000) return "now"
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m`
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h`
  if (elapsed < 604_800_000) return `${Math.floor(elapsed / 86_400_000)}d`
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp)
}

function modelKey(model?: Pick<ModelInfo, "providerID" | "id">) {
  if (!model) return ""
  return `${model.providerID}/${model.id}`
}

function parseModel(value: string) {
  const separator = value.indexOf("/")
  if (separator < 1) return
  return { providerID: value.slice(0, separator), id: value.slice(separator + 1) }
}

function subagentLabel(session: SessionListInfo) {
  if (session.agent) return session.agent
  return session.title.match(/@([\w-]+) subagent/i)?.[1] ?? session.title ?? "subagent"
}

function parentPath(value: string) {
  return value.split("/").slice(0, -1).join("/")
}

function fileName(value: string) {
  return value.replace(/\/$/, "").split("/").at(-1) ?? value
}

function lastAssistantError(messages?: SessionsContextOutput) {
  return messages?.findLast((item) => item.type === "assistant")?.error
}

function transcriptContentVersion(messages?: SessionsContextOutput) {
  const message = messages?.at(-1)
  if (!message) return ""
  if (message.type === "assistant") {
    return `${message.id}:${message.content
      .map((part) => {
        if (part.type === "text" || part.type === "reasoning") return `${part.id}:${part.text.length}`
        const length =
          part.state.status === "pending"
            ? part.state.input.length
            : part.state.content.reduce(
                (total, item) => total + (item.type === "text" ? item.text.length : item.uri.length),
                0,
              )
        return `${part.id}:${part.state.status}:${length}`
      })
      .join("|")}`
  }
  if (message.type === "user") return `${message.id}:${message.text.length}:${message.files?.length ?? 0}`
  if (message.type === "shell") return `${message.id}:${message.output.length}`
  if ("text" in message) return `${message.id}:${message.text.length}`
  return message.id
}

function formatUnknown(value: unknown) {
  if (typeof value === "string") return value
  if (value === undefined) return ""
  return JSON.stringify(value, null, 2)
}

function attachmentDataURL(file: File, mime: string) {
  return new Promise<string | undefined>((resolve) => {
    const reader = new FileReader()
    reader.addEventListener("error", () => resolve(undefined))
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        resolve(undefined)
        return
      }
      const data = reader.result.split(",", 2)[1]
      resolve(data ? `data:${mime};base64,${data}` : undefined)
    })
    reader.readAsDataURL(file)
  })
}

function errorMessage(error: unknown) {
  const fallback =
    typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : String(error)
  return formatServerError(error, undefined, fallback)
}

function providerErrorMessage(message: string) {
  if (message.includes("managed_inference_model_disabled"))
    return "This model is disabled for your OpenCode organization. Choose another model or connect a different provider."
  if (message.includes("billing_insufficient_balance"))
    return "Your OpenCode account has insufficient inference credit. Add at least $0.50 or connect a different provider."
  if (message.includes("Invalid API key"))
    return "The selected provider rejected its API key. Reconnect that provider or choose another one."
  return message
}

function streamPartKey(messageID: string, partID: string) {
  return `${messageID}:${partID}`
}

async function apiRequest<T = void>(connection: Connection, path: string, init: RequestInit = {}) {
  const headers = new Headers(connection.headers)
  for (const [key, value] of new Headers(init.headers)) headers.set(key, value)
  if (init.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json")
  const response = await fetch(new URL(path, connection.url), { ...init, headers })
  if (!response.ok) throw await errorFromResponse(response)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function consumeEvents(
  client: ReturnType<typeof OpenCode.make>,
  signal: AbortSignal,
  receive: (event: EventsSubscribeOutput) => void,
) {
  let handled = 0
  let started = performance.now()
  for await (const event of client.events.subscribe({ signal })) {
    receive(event)
    handled++
    if (handled < 32 && performance.now() - started < 6) continue
    await new Promise<void>((resolve) => setTimeout(resolve))
    handled = 0
    started = performance.now()
  }
}

async function readWorkspaceFile(connection: Connection, directory: string, path: string) {
  const query = new URLSearchParams({ "location[directory]": directory })
  const encoded = path.split("/").map(encodeURIComponent).join("/")
  const response = await fetch(new URL(`/api/fs/read/${encoded}?${query}`, connection.url), {
    headers: connection.headers,
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `${response.status} ${response.statusText}`)
  }
  const blob = await response.blob()
  return new File([blob], fileName(path), { type: blob.type })
}
