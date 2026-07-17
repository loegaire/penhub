import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import HomeFooter from "./home/footer"
import SidebarContext from "./sidebar/context"
import SidebarFiles from "./sidebar/files"
import SidebarFooter from "./sidebar/footer"
import Notifications from "./system/notifications"
import WhichKey from "./system/which-key"

export type BuiltinTuiPlugin = Omit<TuiPluginModule, "id"> & {
  id: string
  tui: TuiPlugin
  enabled?: boolean
}

export function createBuiltinPlugins(options: { experimentalEventSystem: boolean }): BuiltinTuiPlugin[] {
  return [
    HomeFooter,
    SidebarContext,
    SidebarFiles,
    SidebarFooter,
    Notifications,
    WhichKey,
  ]
}
