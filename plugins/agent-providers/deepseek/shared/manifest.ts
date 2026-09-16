import type { PluginManifest } from "@twodb/contracts";
import { PLUGIN_ID } from "./constants";

export const deepseekManifest: PluginManifest = {
	id: PLUGIN_ID,
	name: "@twodb/agent-provider-deepseek",
	version: "1.0.0",
};
