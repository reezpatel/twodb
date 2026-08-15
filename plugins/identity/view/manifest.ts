import type { PluginManifest } from "@twodb/contracts";

export default {
	id: "twodb.identity",
	name: "@twodb/identity-view",
	version: "1.0.0",
	provides: {
		functions: [],
		routes: [],
	},
	emits: [],
	consumes: [],
	permissions: [],
	provider: "identity",
} as const satisfies PluginManifest;
