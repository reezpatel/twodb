import type { IPlugin, PluginStore } from "react-pluggable";
import { AzureOpenAIConfigurator } from "./configurator";

export class TwodbAzureOpenAIPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderAzureOpenAI@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "azure-openai",
			label: "Azure OpenAI",
			usage: false,
			component: AzureOpenAIConfigurator,
		});
	}

	deactivate(): void {}
}
