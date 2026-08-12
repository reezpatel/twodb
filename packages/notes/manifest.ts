import type { PluginManifest } from "@twodb/contracts";

/**
 * The notes plugin's public surface: what it needs, what it offers, what it
 * says. Imported by both halves (view + service) and by host registries.
 */
export default {
	id: "twodb.notes",
	name: "@twodb/plugin-notes",
	version: "1.0.0",
	provides: {
		functions: [],
		routes: ["/api/v1/twodb.notes"],
	},
	emits: [
		"twodb.notes.note.created",
		"twodb.notes.note.updated",
		"twodb.notes.note.deleted",
		"twodb.notes.note.selected",
	],
	consumes: [],
	permissions: ["twodb.notes:read", "twodb.notes:write"],
} as const satisfies PluginManifest;
