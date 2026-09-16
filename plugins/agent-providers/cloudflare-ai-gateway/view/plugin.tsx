import type { IPlugin, PluginStore } from "react-pluggable";
import { CloudflareAIGatewayConfigurator } from "./configurator";

export class TwodbCloudflareAIGatewayPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderCloudflareAIGateway@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "cloudflare-ai-gateway",
			label: "Cloudflare AI Gateway",
			usage: false,
			component: CloudflareAIGatewayConfigurator,
		});
	}

	deactivate(): void {}
}
