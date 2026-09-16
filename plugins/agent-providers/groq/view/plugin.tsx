import type { IPlugin, PluginStore } from "react-pluggable";
import { GroqConfigurator } from "./configurator";

export class TwodbGroqPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderGroq@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "groq",
			label: "Groq",
			usage: false,
			component: GroqConfigurator,
		});
	}

	deactivate(): void {}
}
