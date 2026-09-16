import type { PluginManifest } from "@twodb/contracts";
import { PLUGIN_ID } from "./constants";

export const googleManifest: PluginManifest = {
	id: PLUGIN_ID,
	name: "@twodb/agent-provider-google",
	version: "1.0.0",
};
