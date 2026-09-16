import type { PluginManifest } from "@twodb/contracts";
import { PLUGIN_ID } from "./constants";

export const azureOpenaiManifest: PluginManifest = {
	id: PLUGIN_ID,
	name: "@twodb/agent-provider-azure-openai",
	version: "1.0.0",
};
