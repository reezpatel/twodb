import type { PluginManifest } from "@twodb/contracts";

export default {
	id: "twodb.identity",
	name: "@twodb/plugin-identity",
	version: "1.0.0",
	provides: {
		functions: [],
		routes: ["/api/v1/twodb.identity"],
	},
	emits: [
		"twodb.identity.user.created",
		"twodb.identity.session.started",
		"twodb.identity.org.created",
		"twodb.identity.workspace.created",
		"twodb.identity.workspace.member.added",
		"twodb.identity.workspace.member.removed",
		"twodb.identity.role.created",
		"twodb.identity.role.assigned",
		"twodb.identity.role.revoked",
		"twodb.identity.entity.granted",
		"twodb.identity.entity.revoked",
		"twodb.identity.app.role.assigned",
		"twodb.identity.app.role.revoked",
		"twodb.identity.authmethod.configured",
	],
	consumes: [],
	permissions: [
		"plugin.twodb.identity:org.manage",
		"plugin.twodb.identity:workspace.create",
		"plugin.twodb.identity:workspace.manage",
		"plugin.twodb.identity:member.invite",
		"plugin.twodb.identity:member.remove",
		"plugin.twodb.identity:role.manage",
		"plugin.twodb.identity:app.manage",
	],
	roleDefaults: {
		manager: [
			"plugin.twodb.identity:workspace.manage",
			"plugin.twodb.identity:member.invite",
			"plugin.twodb.identity:member.remove",
			"plugin.twodb.identity:role.manage",
			"plugin.twodb.identity:app.manage",
		],
	},
} as const satisfies PluginManifest;
