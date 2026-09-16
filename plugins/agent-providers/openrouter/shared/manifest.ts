import type { PluginManifest } from "@twodb/contracts";
import { PLUGIN_ID } from "./constants";

export const openrouterManifest: PluginManifest = {
	id: PLUGIN_ID,
	name: "@twodb/agent-provider-openrouter",
	version: "1.0.0",
};
