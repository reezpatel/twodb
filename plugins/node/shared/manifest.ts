import type { PluginManifest } from "@twodb/contracts";
import { PLUGIN_ID } from "./constants";

export const nodeManifest: PluginManifest = {
	id: PLUGIN_ID,
	name: "@twodb/node",
	version: "1.0.0",
};
