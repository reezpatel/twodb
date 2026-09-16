import type { PluginManifest } from "@twodb/contracts";
import { PLUGIN_ID } from "./constants";

export const ollamaCloudManifest: PluginManifest = {
	id: PLUGIN_ID,
	name: "@twodb/agent-provider-ollama-cloud",
	version: "1.0.0",
};
