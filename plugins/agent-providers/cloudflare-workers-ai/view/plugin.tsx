import type { IPlugin, PluginStore } from "react-pluggable";
import { CloudflareWorkersAIConfigurator } from "./configurator";

export class TwodbCloudflareWorkersAIPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderCloudflareWorkersAI@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "cloudflare-workers-ai",
			label: "Cloudflare Workers AI",
			usage: false,
			component: CloudflareWorkersAIConfigurator,
		});
	}

	deactivate(): void {}
}
