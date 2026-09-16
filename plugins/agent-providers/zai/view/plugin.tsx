import type { IPlugin, PluginStore } from "react-pluggable";
import { ZaiConfigurator } from "./configurator";

export class TwodbZaiPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderZai@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "zai",
			label: "Z.ai Coding Plan",
			usage: true,
			component: ZaiConfigurator,
		});
	}

	deactivate(): void {}
}
