import type { PluginManifest } from "@twodb/contracts";
import { PLUGIN_ID } from "./constants";

export const openaiManifest: PluginManifest = {
	id: PLUGIN_ID,
	name: "@twodb/agent-provider-openai",
	version: "1.0.0",
};
