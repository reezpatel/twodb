import type { IPlugin, PluginStore } from "react-pluggable";
import type { RouteObject } from "react-router";
import { CodeScene as CodeSceneOld } from "./code/code-scene";
import { CodeScene } from "./scene/code/code-scene";

export class TwodbCodePlugin implements IPlugin {
  pluginStore!: PluginStore;
  namespace = "Identity";

  private routes: RouteObject[] = [
    {
      path: "/code-old",
      element: <CodeSceneOld />,
    },
    {
      path: "/code",
      element: <CodeScene />,
    },
  ];

  getPluginName(): string {
    return "Code@1.0.0";
  }

  getDependencies(): string[] {
    return [];
  }

  init(pluginStore: PluginStore): void {
    this.pluginStore = pluginStore;
  }

  activate(): void {
    // this.pluginStore.addFunction("useIdentity", useTwoDbIdentity);

    this.pluginStore.executeFunction("core::add_routes", this.routes);
  }

  deactivate(): void {
    // this.pluginStore.removeFunction(`useIdentity`);
  }
}
