import type { IPlugin, PluginStore } from "react-pluggable";
import type { RouteObject } from "react-router";
import { ChatScene } from "./chat-scene";

export class TwodbChatPlugin implements IPlugin {
	pluginStore!: PluginStore;

	private routes: RouteObject[] = [{ path: "/chat", element: <ChatScene /> }];

	getPluginName(): string {
		return "Chat@1.0.0";
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
