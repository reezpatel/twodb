import type { IPlugin, PluginStore } from "react-pluggable";
import type { RouteObject } from "react-router";

export class CorePlugin implements IPlugin {
  pluginStore!: PluginStore;

  private routes: RouteObject[] = [];

  getPluginName(): string {
    return "twodb-core";
  }

  getDependencies(): string[] {
    return [];
  }

  init(pluginStore: PluginStore): void {
    this.pluginStore = pluginStore;
  }

  activate(): void {
    this.pluginStore.addFunction(`core::get_routes`, () => {
      return this.routes;
    });

    this.pluginStore.addFunction(`core::add_route`, (route: RouteObject) => {
      this.routes.push(route);
    });

    this.pluginStore.addFunction(
      `core::add_routes`,
      (routes: RouteObject[]) => {
        this.routes.push(...routes);
      },
    );
  }

  deactivate(): void {
    this.pluginStore.removeFunction(`core::get_routes`);
  }
}
