import type { IPlugin, PluginStore } from "react-pluggable";
import type { RouteObject } from "react-router";
import { PLUGIN_ID } from "../shared/constants";
import { AgentCreateScene } from "./settings/agent-create-scene";
import { AgentEditScene } from "./settings/agent-edit-scene";
import { AgentNewScene } from "./settings/agent-new-scene";
import { AgentsScene } from "./settings/agents-scene";
import {
	getProviderConfigurator,
	registerProviderConfigurator,
	type ProviderConfiguratorEntry,
} from "./lib/provider-registry";

const SETTINGS = `/settings/${PLUGIN_ID}`;

export class TwodbAgentPlugin implements IPlugin {
	pluginStore!: PluginStore;

	private routes: RouteObject[] = [
		{ path: SETTINGS, element: <AgentsScene /> },
		{ path: `${SETTINGS}/new`, element: <AgentNewScene /> },
		{ path: `${SETTINGS}/new/:providerId`, element: <AgentCreateScene /> },
		{ path: `${SETTINGS}/:agentId/edit`, element: <AgentEditScene /> },
	];

	getPluginName(): string {
		return "Agent@1.0.0";
	}

	getDependencies(): string[] {
		return [];
	}

	init(pluginStore: PluginStore): void {
		this.pluginStore = pluginStore;
	}

	activate(): void {
		this.pluginStore.executeFunction("core::add_routes", this.routes);
		this.pluginStore.addFunction(
			"agent::register_provider_configurator",
			(entry: ProviderConfiguratorEntry) => registerProviderConfigurator(entry),
		);
		this.pluginStore.addFunction(
			"agent::get_provider_info",
			(providerId: string) => {
				const entry = getProviderConfigurator(providerId);
				return entry
					? { label: entry.label, models: entry.models ?? [] }
					: undefined;
			},
		);
	}

	deactivate(): void {}
}
