import type { PluginManifest } from "@twodb/contracts";
import { PLUGIN_ID } from "./constants";

export const anthropicManifest: PluginManifest = {
	id: PLUGIN_ID,
	name: "@twodb/agent-provider-anthropic",
	version: "1.0.0",
};
