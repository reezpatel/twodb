import type { IPlugin, PluginStore } from "react-pluggable";
import { CustomOpenAIConfigurator } from "./configurator";

export class TwodbCustomOpenAIPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderCustomOpenAI@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "custom-openai",
			label: "OpenAI-compatible",
			usage: false,
			component: CustomOpenAIConfigurator,
		});
	}

	deactivate(): void {}
}
