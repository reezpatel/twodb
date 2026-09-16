import type { IPlugin, PluginStore } from "react-pluggable";
import { KiloCodeConfigurator } from "./configurator";

export class TwodbKiloCodePlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderKiloCode@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "kilocode",
			label: "Kilo Code",
			usage: true,
			component: KiloCodeConfigurator,
		});
	}

	deactivate(): void {}
}
