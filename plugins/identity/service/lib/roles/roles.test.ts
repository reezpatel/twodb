import { describe, expect, it } from "vitest";
import type { Claim } from "@twodb/contracts";
import type { PluginManifest } from "../types";
import { systemRoleClaims, slugifyRoleKey, isSystemRoleKey } from "./roles";

const identity: PluginManifest = {
	id: "twodb.identity",
	name: "Identity",
	version: "1.0.0",
	provides: { functions: [], routes: [] },
	emits: [],
	consumes: [],
	permissions: [
		"plugin.twodb.identity:workspace.manage",
		"plugin.twodb.identity:member.invite",
		"plugin.twodb.identity:role.manage",
	],
	roleDefaults: {
		manager: [
			"plugin.twodb.identity:workspace.manage",
			"plugin.twodb.identity:member.invite",
			"plugin.twodb.identity:role.manage",
		],
	},
};

const notes: PluginManifest = {
	id: "twodb.notes",
	name: "Notes",
	version: "1.0.0",
	provides: { functions: [], routes: [] },
	emits: [],
	consumes: [],
	permissions: [
		"plugin.twodb.notes:note.read",
		"plugin.twodb.notes:note.create",
		"plugin.twodb.notes:note.edit",
		"plugin.twodb.notes:note.delete",
	],
	roleDefaults: {
		editor: ["plugin.twodb.notes:note.create", "plugin.twodb.notes:note.edit"],
		reader: ["plugin.twodb.notes:note.read"],
	},
};

const ledger: PluginManifest = {
	id: "ledger",
	name: "Ledger",
	version: "1.0.0",
	provides: { functions: [], routes: [] },
	emits: [],
	consumes: [],
	permissions: ["app.ledger:entry.create"],
};

const all = new Set<Claim>([
	...identity.permissions,
	...notes.permissions,
	...ledger.permissions,
]);

describe("systemRoleClaims", () => {
	it("owner = full catalog", () => {
		const r = systemRoleClaims(all, [identity, notes, ledger]);
		expect(r.owner.size).toBe(all.size);
	});

	it("guest = empty", () => {
		const r = systemRoleClaims(all, [identity, notes, ledger]);
		expect(r.guest.size).toBe(0);
	});

	it("manager = union of every plugin's manager roleDefaults", () => {
		const r = systemRoleClaims(all, [identity, notes, ledger]);
		expect(r.manager.has("plugin.twodb.identity:workspace.manage")).toBe(true);
		expect(r.manager.has("plugin.twodb.identity:member.invite")).toBe(true);
		expect(r.manager.has("plugin.twodb.identity:role.manage")).toBe(true);
		// notes declares no roleDefaults.manager; manager should NOT gain
		// notes-only claims through the union.
		expect(r.manager.has("plugin.twodb.notes:note.create")).toBe(false);
	});

	it("editor + reader = union of those plugins' roleDefaults", () => {
		const r = systemRoleClaims(all, [identity, notes, ledger]);
		expect(r.editor.has("plugin.twodb.notes:note.create")).toBe(true);
		expect(r.editor.has("plugin.twodb.notes:note.edit")).toBe(true);
		expect(r.editor.has("plugin.twodb.notes:note.read")).toBe(false);
		expect(r.reader.has("plugin.twodb.notes:note.read")).toBe(true);
		expect(r.reader.has("plugin.twodb.notes:note.create")).toBe(false);
	});

	it("app.* claims show up only in owner's set, never in role buckets", () => {
		const r = systemRoleClaims(all, [identity, notes, ledger]);
		expect(r.owner.has("app.ledger:entry.create" as Claim)).toBe(true);
		expect(r.manager.has("app.ledger:entry.create" as Claim)).toBe(false);
		expect(r.editor.has("app.ledger:entry.create" as Claim)).toBe(false);
		expect(r.reader.has("app.ledger:entry.create" as Claim)).toBe(false);
	});

	it("manager/editor/reader keys absent from a manifest do not error", () => {
		const r = systemRoleClaims(all, [identity]);
		expect(r.editor.size).toBe(0);
		expect(r.reader.size).toBe(0);
	});
});

describe("slugifyRoleKey", () => {
	it("lowercase, dash-joined, no leading/trailing dashes", () => {
		expect(slugifyRoleKey("Project Lead")).toBe("project-lead");
		expect(slugifyRoleKey("Curator's Picks!")).toBe("curators-picks");
		expect(slugifyRoleKey("---")).toBe("role");
	});
});

describe("isSystemRoleKey", () => {
	it("recognises the five reserved keys", () => {
		for (const k of ["owner", "manager", "editor", "reader", "guest"]) {
			expect(isSystemRoleKey(k)).toBe(true);
		}
		expect(isSystemRoleKey("curator")).toBe(false);
	});
});
