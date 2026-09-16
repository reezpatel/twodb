import type { PluginManifest } from "@twodb/contracts";
import { PLUGIN_ID } from "./constants";

export const mistralManifest: PluginManifest = {
	id: PLUGIN_ID,
	name: "@twodb/agent-provider-mistral",
	version: "1.0.0",
};
