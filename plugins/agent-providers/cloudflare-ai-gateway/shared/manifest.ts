import type { PluginManifest } from "@twodb/contracts";
import { PLUGIN_ID } from "./constants";

export const cloudflareAiGatewayManifest: PluginManifest = {
	id: PLUGIN_ID,
	name: "@twodb/agent-provider-cloudflare-ai-gateway",
	version: "1.0.0",
};
