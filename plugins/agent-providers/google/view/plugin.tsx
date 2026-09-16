import type { IPlugin, PluginStore } from "react-pluggable";
import { GoogleGeminiConfigurator } from "./configurator";

export class TwodbGoogleGeminiPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderGoogleGemini@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "google",
			label: "Google Gemini",
			usage: false,
			component: GoogleGeminiConfigurator,
		});
	}

	deactivate(): void {}
}
