import type { IPlugin, PluginStore } from "react-pluggable";
import { MistralConfigurator } from "./configurator";

export class TwodbMistralPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderMistral@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "mistral",
			label: "Mistral",
			usage: false,
			component: MistralConfigurator,
		});
	}

	deactivate(): void {}
}
