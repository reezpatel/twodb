import type { IPlugin, PluginStore } from "react-pluggable";
import type { RouteObject } from "react-router";
import { PLUGIN_ID } from "../shared/constants";
import { NodesScene } from "./settings/nodes-scene";

const SETTINGS = `/settings/${PLUGIN_ID}`;

export class TwodbNodePlugin implements IPlugin {
	pluginStore!: PluginStore;

	private routes: RouteObject[] = [{ path: SETTINGS, element: <NodesScene /> }];

	getPluginName(): string {
		return "Node@1.0.0";
	}

	getDependencies(): string[] {
		return [];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("core::add_routes", this.routes);
	}

	deactivate(): void {}
}
