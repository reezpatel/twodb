import type { IPlugin, PluginStore } from "react-pluggable";
import { OpenAIConfigurator } from "./configurator";

export class TwodbOpenAIPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderOpenAI@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "openai",
			label: "OpenAI",
			usage: true,
			component: OpenAIConfigurator,
		});
	}

	deactivate(): void {}
}
