import type { ViewPlugin } from "@twodb/shared-frontend";
import { AdminSettings } from "./admin-settings";
import { NodesSettings } from "./sections/settings/nodes-settings";

const NodeViewPlugin = {
  id: "io.twodb.node",
  name: "Machines",

  admin: {
    settings: AdminSettings,
  },

  workspace: {
    settings: <NodesSettings />,
  },
} satisfies ViewPlugin;

export default NodeViewPlugin;
