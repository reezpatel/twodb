import type { IPlugin, PluginStore } from "react-pluggable";
import { DeepSeekConfigurator } from "./configurator";

export class TwodbDeepSeekPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderDeepSeek@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "deepseek",
			label: "DeepSeek",
			usage: false,
			component: DeepSeekConfigurator,
		});
	}

	deactivate(): void {}
}
