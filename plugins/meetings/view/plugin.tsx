import type { IPlugin, PluginStore } from "react-pluggable";
import type { RouteObject } from "react-router";
import { MeetingsScene } from "./scene/meetings-scene";

export class TwodbMeetingsPlugin implements IPlugin {
	pluginStore!: PluginStore;
	namespace = "Meetings";

	private routes: RouteObject[] = [
		{
			path: "/meetings",
			element: <MeetingsScene />,
		},
	];

	getPluginName(): string {
		return "Meetings@1.0.0";
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
