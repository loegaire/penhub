import { Location } from "@opencode-ai/schema/location"
import { PenHub } from "@opencode-ai/schema/penhub"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { LocationQuery, locationQueryOpenApi } from "./location"
import { InvalidRequestError, ServiceUnavailableError } from "../errors"

export const PenHubGroup = HttpApiGroup.make("server.penhub")
  .add(
    HttpApiEndpoint.get("penhub.tools.list", "/api/penhub/tools", {
      query: LocationQuery,
      success: Location.response(Schema.Array(PenHub.ToolPackInfo)),
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.penhub.tools.list",
          summary: "List packaged security tools",
          description: "List PenHub OCI tool packs, included tools, and local image availability.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.get("penhub.state.get", "/api/penhub/state", {
      query: LocationQuery,
      success: Location.response(PenHub.StateSnapshot),
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.penhub.state.get",
          summary: "Get live PenHub state",
          description: "Read the compact attack state and current report from the active workspace.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.get("penhub.explorer.load", "/api/penhub/explorer", {
      query: LocationQuery,
      success: Location.response(PenHub.PenHubExplorerTabPayload),
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.penhub.explorer.load",
          summary: "Get explorer payload for PenHub constructs",
          description: "Load state-card, run state, attempts, lessons, and findings for UI tab rendering.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.post("penhub.artifact.read", "/api/penhub/artifact", {
      query: LocationQuery,
      payload: PenHub.PenHubArtifactReadInput,
      success: Location.response(PenHub.PenHubArtifactReadOutput),
      error: InvalidRequestError,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.penhub.artifact.read",
          summary: "Read bounded artifact output from the PenHub workspace",
          description: "Read a bounded artifact window from .penhub/artifacts using head/tail/lines/grep mode.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.post("penhub.report.generate", "/api/penhub/report", {
      query: LocationQuery,
      success: Location.response(PenHub.ReportResult),
      error: ServiceUnavailableError,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.penhub.report.generate",
          summary: "Generate the evidence report",
          description: "Regenerate the Markdown report from durable PenHub state.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.post("penhub.tools.pull", "/api/penhub/tools/:pack/pull", {
      params: { pack: PenHub.ToolPackID },
      query: LocationQuery,
      success: Location.response(PenHub.PullResult),
      error: ServiceUnavailableError,
    })
      .annotateMerge(locationQueryOpenApi)
      .annotateMerge(
        OpenApi.annotations({
          identifier: "v2.penhub.tools.pull",
          summary: "Pull a security tool pack",
          description: "Pull one versioned PenHub OCI image with Docker or Podman.",
        }),
      ),
  )
  .add(
    HttpApiEndpoint.get("penhub.litellm.status", "/api/penhub/litellm", {
      success: PenHub.LiteLLMStatus,
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "v2.penhub.litellm.status",
        summary: "Get local LiteLLM status",
        description: "Check whether the user-installed LiteLLM proxy is available to PenHub.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("penhub.litellm.start", "/api/penhub/litellm", {
      payload: PenHub.LiteLLMStart,
      success: PenHub.LiteLLMStatus,
      error: ServiceUnavailableError,
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "v2.penhub.litellm.start",
        summary: "Start local LiteLLM",
        description: "Start the user-installed LiteLLM proxy with a local YAML configuration file.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("penhub.litellm.stop", "/api/penhub/litellm/stop", {
      success: PenHub.LiteLLMStatus,
      error: ServiceUnavailableError,
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "v2.penhub.litellm.stop",
        summary: "Stop local LiteLLM",
        description: "Stop the LiteLLM process started by this PenHub server.",
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({ title: "PenHub", description: "Security-agent state and packaged tool routes." }),
  )
