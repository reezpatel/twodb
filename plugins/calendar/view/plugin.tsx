import type { IPlugin, PluginStore } from "react-pluggable";
import type { RouteObject } from "react-router";
import { CalendarScene } from "./scene/calendar-scene";

export class TwodbCalendarPlugin implements IPlugin {
	pluginStore!: PluginStore;
	namespace = "Calendar";

	private routes: RouteObject[] = [
		{
			path: "/calendar",
			element: <CalendarScene />,
		},
	];

	getPluginName(): string {
		return "Calendar@1.0.0";
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
