import type { IPlugin, PluginStore } from "react-pluggable";
import { ClineConfigurator } from "./configurator";

export class TwodbClinePlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderCline@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "cline",
			label: "Cline",
			usage: true,
			component: ClineConfigurator,
		});
	}

	deactivate(): void {}
}
