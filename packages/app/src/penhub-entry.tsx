import "@/index.css"
import { MarkedProvider } from "@opencode-ai/ui/context/marked"
import { render } from "solid-js/web"
import PenHubWorkspace from "@/features/penhub/PenHubWorkspace"

const root = document.getElementById("root")
if (!root) throw new Error("PenHub root element is missing")

document.body.setAttribute("data-new-layout", "")
const params = new URLSearchParams(location.search)
render(
  () => (
    <MarkedProvider>
      <PenHubWorkspace
        serverUrl={import.meta.env.VITE_PENHUB_SERVER_URL ?? params.get("server") ?? "http://localhost:4096"}
        workspace={params.get("workspace") ?? undefined}
      />
    </MarkedProvider>
  ),
  root,
)
