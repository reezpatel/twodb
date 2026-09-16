import type { IPlugin, PluginStore } from "react-pluggable";
import { MiniMaxConfigurator } from "./configurator";

export class TwodbMiniMaxPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderMiniMax@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "minimax",
			label: "MiniMax Coding Plan",
			usage: true,
			component: MiniMaxConfigurator,
		});
	}

	deactivate(): void {}
}
