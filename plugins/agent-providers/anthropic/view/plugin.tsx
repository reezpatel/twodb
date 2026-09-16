import type { IPlugin, PluginStore } from "react-pluggable";
import { AnthropicConfigurator } from "./configurator";

export class TwodbAnthropicPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderAnthropic@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "anthropic",
			label: "Anthropic",
			usage: true,
			component: AnthropicConfigurator,
		});
	}

	deactivate(): void {}
}
