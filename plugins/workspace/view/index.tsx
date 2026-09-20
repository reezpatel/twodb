import { WorkspaceProvider } from "./provider/workspace-provider";
import { useWorkspace } from "./hooks/use-workspace";
import type { ViewPlugin } from "@twodb/shared-frontend";

const WorkspaceViewPlugin = {
  id: "io.twodb.workspace",

  providers: [
    {
      provider: WorkspaceProvider,
      priority: 90,
      provides: "workspace",
      hooks: {
        useWorkspace,
      },
    },
  ],
} satisfies ViewPlugin;

export default WorkspaceViewPlugin;
