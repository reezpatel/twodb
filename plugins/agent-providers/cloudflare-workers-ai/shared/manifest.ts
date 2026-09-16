import type { PluginManifest } from "@twodb/contracts";
import { PLUGIN_ID } from "./constants";

export const cloudflareWorkersAiManifest: PluginManifest = {
	id: PLUGIN_ID,
	name: "@twodb/agent-provider-cloudflare-workers-ai",
	version: "1.0.0",
};
