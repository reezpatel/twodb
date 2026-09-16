import type { IPlugin, PluginStore } from "react-pluggable";
import { FireworksConfigurator } from "./configurator";

export class TwodbFireworksPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderFireworks@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "fireworks",
			label: "Fireworks",
			usage: false,
			component: FireworksConfigurator,
		});
	}

	deactivate(): void {}
}
