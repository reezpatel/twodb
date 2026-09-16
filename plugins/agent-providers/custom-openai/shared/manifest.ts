import type { PluginManifest } from "@twodb/contracts";
import { PLUGIN_ID } from "./constants";

export const customOpenaiManifest: PluginManifest = {
	id: PLUGIN_ID,
	name: "@twodb/agent-provider-custom-openai",
	version: "1.0.0",
};
