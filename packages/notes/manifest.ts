import type { PluginManifest } from "@twodb/contracts";

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
	permissions: [
		"plugin.twodb.notes:note.read",
		"plugin.twodb.notes:note.create",
		"plugin.twodb.notes:note.edit",
		"plugin.twodb.notes:note.delete",
		"plugin.twodb.notes:note.share",
	],
	roleDefaults: {
		manager: [
			"plugin.twodb.notes:note.read",
			"plugin.twodb.notes:note.create",
			"plugin.twodb.notes:note.edit",
			"plugin.twodb.notes:note.delete",
			"plugin.twodb.notes:note.share",
		],
		editor: [
			"plugin.twodb.notes:note.read",
			"plugin.twodb.notes:note.create",
			"plugin.twodb.notes:note.edit",
			"plugin.twodb.notes:note.share",
		],
		reader: ["plugin.twodb.notes:note.read"],
	},
} as const satisfies PluginManifest;
