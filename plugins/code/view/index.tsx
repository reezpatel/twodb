import { Code2 } from "lucide-react";
import type { ViewPlugin, ViewPluginInitContext } from "@twodb/shared-frontend";
import { CodeSettings } from "./sections/settings/code-settings";
import { CodeScene } from "./sections/workbench/code-scene";

let invokeFn: ViewPluginInitContext["invoke"] | null = null;

const CodeViewPlugin = {
  id: "io.twodb.code",
  name: "Code",

  routes: {
    "/code": CodeScene,
  },

  functions: {
    "code.open": () => invokeFn?.("core.navigate", "/code"),
  },

  init: (ctx: ViewPluginInitContext) => {
    invokeFn = ctx.invoke;
    ctx.addNavItem({ id: "code", label: "Code", path: "/code", icon: <Code2 size={15} /> });
  },

  workspace: {
    settings: <CodeSettings />,
  },
} satisfies ViewPlugin;

export default CodeViewPlugin;
