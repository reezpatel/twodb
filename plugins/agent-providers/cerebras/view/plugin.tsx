import type { IPlugin, PluginStore } from "react-pluggable";
import { CerebrasConfigurator } from "./configurator";

export class TwodbCerebrasPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderCerebras@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "cerebras",
			label: "Cerebras",
			usage: false,
			component: CerebrasConfigurator,
		});
	}

	deactivate(): void {}
}
