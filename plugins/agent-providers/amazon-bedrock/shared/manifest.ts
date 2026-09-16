import type { PluginManifest } from "@twodb/contracts";
import { PLUGIN_ID } from "./constants";

export const amazonBedrockManifest: PluginManifest = {
	id: PLUGIN_ID,
	name: "@twodb/agent-provider-amazon-bedrock",
	version: "1.0.0",
};
