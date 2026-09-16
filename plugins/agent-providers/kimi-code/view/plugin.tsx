import type { IPlugin, PluginStore } from "react-pluggable";
import { KIMI_CODE_MODELS } from "../shared/models";
import { KimiCodeConfigurator } from "./configurator";

export class TwodbKimiCodePlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderKimiCode@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		const models = KIMI_CODE_MODELS.map((model) => ({
			id: model.id,
			label: model.name,
		}));
		// "kimi" is the legacy catalog id for the same vendor — alias it so
		// connections created before the plugin existed keep working.
		for (const providerId of ["kimi-code", "kimi"]) {
			this.pluginStore.executeFunction(
				"agent::register_provider_configurator",
				{
					providerId,
					label: "Kimi For Coding",
					usage: true,
					models,
					component: KimiCodeConfigurator,
				},
			);
		}
	}

	deactivate(): void {}
}
