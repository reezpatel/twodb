import type { IPlugin, PluginStore } from "react-pluggable";
import type { RouteObject } from "react-router";
import { NotesShell } from "./shell/note-shell";
import { ContentTree } from "./components/content-tree/content-tree";

export class TwodbContentPlugin implements IPlugin {
  pluginStore!: PluginStore;
  namespace = "Content";

  private routes: RouteObject[] = [
    {
      path: "/notes/:sectionId",
      element: <NotesShell />,
    },
  ];

  getPluginName(): string {
    return "Content@1.0.0";
  }

  getDependencies(): string[] {
    return [];
  }

  init(pluginStore: PluginStore): void {
    this.pluginStore = pluginStore;
  }

  activate(): void {
    this.pluginStore.executeFunction("core::add_routes", this.routes);

    this.pluginStore.executeFunction("Renderer.add", "sidebar_section", () => (
      <ContentTree />
    ));
  }

  deactivate(): void {}
}
