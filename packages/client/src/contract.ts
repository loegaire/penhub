import { makeDefaultApi } from "@opencode-ai/protocol/api"
import { InvalidRequestError, SessionNotFoundError } from "@opencode-ai/protocol/errors"
import { HttpApi, HttpApiMiddleware } from "effect/unstable/httpapi"

class LocationMiddleware extends HttpApiMiddleware.Service<LocationMiddleware>()(
  "@opencode-ai/client/LocationMiddleware",
) {}

class SessionLocationMiddleware extends HttpApiMiddleware.Service<SessionLocationMiddleware>()(
  "@opencode-ai/client/SessionLocationMiddleware",
  { error: [InvalidRequestError, SessionNotFoundError] },
) {}

const Api = makeDefaultApi({
  locationMiddleware: LocationMiddleware,
  sessionLocationMiddleware: SessionLocationMiddleware,
})

export const SessionGroup = Api.groups["server.session"]
export const EventGroup = Api.groups["server.event"]
export const PenHubGroup = Api.groups["server.penhub"]
export const AgentGroup = Api.groups["server.agent"]
export const ModelGroup = Api.groups["server.model"]
export const ProviderGroup = Api.groups["server.provider"]
export const IntegrationGroup = Api.groups["server.integration"]
export const CredentialGroup = Api.groups["server.credential"]
export const PermissionGroup = Api.groups["server.permission"]
export const QuestionGroup = Api.groups["server.question"]
export const CommandGroup = Api.groups["server.command"]
export const SkillGroup = Api.groups["server.skill"]
export const FileSystemGroup = Api.groups["server.fs"]
export const PtyGroup = Api.groups["server.pty"]
export const LocationGroup = Api.groups["server.location"]
export const ReferenceGroup = Api.groups["server.reference"]

export const ClientApi = HttpApi.make("opencode-client")
  .add(SessionGroup)
  .add(EventGroup)
  .add(ModelGroup)
  .add(ProviderGroup)
  .add(IntegrationGroup)
  .add(CredentialGroup)
  .add(CommandGroup)
  .add(SkillGroup)
  .add(LocationGroup)
  .add(ReferenceGroup)
  .add(PenHubGroup)
