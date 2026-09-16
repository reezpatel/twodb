import type { PluginManifest } from "@twodb/contracts";
import { PLUGIN_ID } from "./constants";

export const chatManifest: PluginManifest = {
	id: PLUGIN_ID,
	name: "@twodb/chat",
	version: "1.0.0",
};
