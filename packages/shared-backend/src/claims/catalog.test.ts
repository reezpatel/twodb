import { describe, expect, it } from "vitest";
import type { Claim } from "@twodb/contracts";
import {
	buildClaimCatalog,
	claimOwner,
	danglingClaims,
	type PluginManifest,
	type PluginId,
} from "./catalog";

const notesManifest: PluginManifest = {
	id: "twodb.notes",
	name: "Notes",
	version: "1.0.0",
	permissions: [
		"plugin.twodb.notes:note.create",
		"plugin.twodb.notes:note.edit",
		"plugin.twodb.notes:note.read",
		"plugin.twodb.notes:note.delete",
	],
	roleDefaults: {
		manager: [
			"plugin.twodb.notes:note.create",
			"plugin.twodb.notes:note.edit",
			"plugin.twodb.notes:note.read",
			"plugin.twodb.notes:note.delete",
		],
		editor: [
			"plugin.twodb.notes:note.create",
			"plugin.twodb.notes:note.edit",
			"plugin.twodb.notes:note.read",
		],
		reader: ["plugin.twodb.notes:note.read"],
	},
};

const identityManifest: PluginManifest = {
	id: "twodb.identity",
	name: "Identity",
	version: "1.0.0",
	permissions: [
		"plugin.twodb.identity:workspace.manage",
		"plugin.twodb.identity:member.invite",
	],
	roleDefaults: {
		manager: [
			"plugin.twodb.identity:workspace.manage",
			"plugin.twodb.identity:member.invite",
		],
	},
};

const ledgerManifest: PluginManifest = {
	id: "ledger",
	name: "Ledger App",
	version: "1.0.0",
	permissions: ["app.ledger:entry.create", "app.ledger:entry.read"],
};

describe("buildClaimCatalog", () => {
	it("collects every permission across manifests", async () => {
		const catalog = await buildClaimCatalog([notesManifest, identityManifest]);
		expect(catalog.all.has("plugin.twodb.notes:note.create")).toBe(true);
		expect(catalog.all.has("plugin.twodb.identity:workspace.manage")).toBe(
			true,
		);
	});

	it("groups per-plugin claim sets", async () => {
		const catalog = await buildClaimCatalog([notesManifest, identityManifest]);
		const notes = catalog.byPlugin.get("twodb.notes" as PluginId);
		expect(notes?.has("plugin.twodb.notes:note.create")).toBe(true);
		expect(notes?.has("plugin.twodb.identity:workspace.manage")).toBe(false);
	});

	it("includes app claims in the union", async () => {
		const catalog = await buildClaimCatalog([notesManifest, ledgerManifest]);
		expect(catalog.all.has("app.ledger:entry.create")).toBe(true);
	});

	it("stores roleDefaults keyed by plugin", async () => {
		const catalog = await buildClaimCatalog([notesManifest]);
		const rd = catalog.roleDefaults.get("twodb.notes" as PluginId);
		expect(rd?.manager).toContain("plugin.twodb.notes:note.create");
		expect(rd?.reader).toEqual(["plugin.twodb.notes:note.read"]);
	});

	it("throws on a manifest with a malformed claim", async () => {
		const bad: PluginManifest = {
			...notesManifest,
			roleDefaults: {},
			permissions: ["not-a-claim" as unknown as Claim],
		};
		await expect(buildClaimCatalog([bad])).rejects.toThrow(/invalid claim/);
	});

	it("throws when roleDefaults references an undeclared claim", async () => {
		const good = ["plugin.twodb.notes:note.read" as Claim];
		const bad: PluginManifest = {
			...notesManifest,
			permissions: good,
			roleDefaults: {
				reader: [
					"plugin.twodb.notes:note.read",
					"plugin.twodb.notes:note.invent" as Claim,
				],
			},
		};
		await expect(buildClaimCatalog([bad])).rejects.toThrow(
			/undeclared claim "plugin\.twodb\.notes:note\.invent"/,
		);
	});
});

describe("claimOwner", () => {
	it("strips the plugin/app prefix from a claim", () => {
		expect(claimOwner("plugin.twodb.notes:note.create")).toBe("twodb.notes");
		expect(claimOwner("app.ledger:entry.read")).toBe("ledger");
	});
});

describe("danglingClaims", () => {
	it("lists catalog claims whose owning plugin is not enabled", async () => {
		const catalog = await buildClaimCatalog([notesManifest, ledgerManifest]);
		const enabled = new Set<PluginId>(["twodb.notes" as PluginId]);
		const result = danglingClaims(catalog, enabled);
		expect(result).toContain("app.ledger:entry.create");
		expect(result).toContain("app.ledger:entry.read");
		expect(result).not.toContain("plugin.twodb.notes:note.create");
	});

	it("is empty when every plugin is enabled", async () => {
		const catalog = await buildClaimCatalog([notesManifest, ledgerManifest]);
		const enabled = new Set<PluginId>([
			"twodb.notes" as PluginId,
			"ledger" as PluginId,
		]);
		expect(danglingClaims(catalog, enabled)).toEqual([]);
	});
});
