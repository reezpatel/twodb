import type { PluginManifest } from "@twodb/contracts";
import { PLUGIN_ID } from "./constants";

export const agentManifest: PluginManifest = {
	id: PLUGIN_ID,
	name: "@twodb/agent",
	version: "1.0.0",
};
