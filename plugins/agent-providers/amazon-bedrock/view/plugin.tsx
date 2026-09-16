import type { IPlugin, PluginStore } from "react-pluggable";
import { AmazonBedrockConfigurator } from "./configurator";

export class TwodbAmazonBedrockPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderAmazonBedrock@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "amazon-bedrock",
			label: "Amazon Bedrock",
			usage: false,
			component: AmazonBedrockConfigurator,
		});
	}

	deactivate(): void {}
}
