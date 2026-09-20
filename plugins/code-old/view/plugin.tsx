import type { IPlugin, PluginStore } from "react-pluggable";
import type { RouteObject } from "react-router";
import { CodeScene as CodeSceneOld } from "./code/code-scene";
import { CodeScene } from "./scene/code/code-scene";
import { CodeSceneNext } from "./scene/code/code-scene-next";

export class TwodbCodePlugin implements IPlugin {
	pluginStore!: PluginStore;
	namespace = "Code";

	private routes: RouteObject[] = [
		{
			path: "/code",
			element: <CodeSceneNext />,
		},
		{
			path: "/code-old",
			element: <CodeScene />,
		},
		{
			path: "/code-old/legacy",
			element: <CodeSceneOld />,
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
		this.pluginStore.executeFunction("core::add_routes", this.routes);
	}

	deactivate(): void {
		// this.pluginStore.removeFunction(`useIdentity`);
	}
}
