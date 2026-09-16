import type { PluginManifest } from "@twodb/contracts";
import { PLUGIN_ID } from "./constants";

export const groqManifest: PluginManifest = {
	id: PLUGIN_ID,
	name: "@twodb/agent-provider-groq",
	version: "1.0.0",
};
