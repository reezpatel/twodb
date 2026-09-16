import type { IPlugin, PluginStore } from "react-pluggable";
import { GoogleVertexConfigurator } from "./configurator";

export class TwodbGoogleVertexPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderGoogleVertex@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "google-vertex",
			label: "Vertex AI",
			usage: false,
			component: GoogleVertexConfigurator,
		});
	}

	deactivate(): void {}
}
