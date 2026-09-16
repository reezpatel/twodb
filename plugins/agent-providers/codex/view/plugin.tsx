import type { IPlugin, PluginStore } from "react-pluggable";
import { CodexConfigurator } from "./configurator";

export class TwodbCodexPlugin implements IPlugin {
	pluginStore!: PluginStore;

	getPluginName(): string {
		return "AgentProviderCodex@1.0.0";
	}

	getDependencies(): string[] {
		return ["Agent@1.0.0"];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("agent::register_provider_configurator", {
			providerId: "codex",
			label: "OpenAI Codex",
			usage: true,
			component: CodexConfigurator,
		});
	}

	deactivate(): void {}
}
