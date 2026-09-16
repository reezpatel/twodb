import type { IPlugin, PluginStore } from "react-pluggable";
import { TogetherAIConfigurator } from "./configurator";

export class TwodbTogetherAIPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderTogetherAI@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "together",
			label: "Together AI",
			usage: false,
			component: TogetherAIConfigurator,
		});
	}

	deactivate(): void {}
}
