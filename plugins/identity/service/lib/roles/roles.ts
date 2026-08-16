import type { Kysely } from "kysely";
import type { Claim } from "@twodb/contracts";
import { newId } from "@twodb/shared-backend";
import type { PluginId, PluginManifest } from "../types";
import type { IdentityDB } from "../../db/schema";

export const SYSTEM_ROLE_KEYS = [
	"owner",
	"manager",
	"editor",
	"reader",
	"guest",
] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export function isSystemRoleKey(value: string): value is SystemRoleKey {
	return (SYSTEM_ROLE_KEYS as readonly string[]).includes(value);
}

export function isSystemRole(role: { is_system: boolean }): boolean {
	return role.is_system;
}

export function slugifyRoleKey(name: string): string {
	return (
		name
			.trim()
			.replace(/['\u2018\u2019`]+/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "role"
	);
}

/**
 * The claims each system role SHOULD hold once seeding runs across the
 * installed plugins (task-05 §5.2):
 *   owner  = the entire catalog (implicit, hard rule 2);
 *   guest  = empty (everything comes from entity_grants — task 6);
 *   manager/editor/reader = the union over installed plugins of
 *     roleDefaults[key].
 *
 * Pure: no DB. The caller passes the catalog and manifests.
 */
export function systemRoleClaims(
	catalog: ReadonlySet<Claim>,
	manifests: readonly PluginManifest[],
): Record<SystemRoleKey, ReadonlySet<Claim>> {
	const owner = new Set<Claim>(catalog);
	const guest = new Set<Claim>();
	const buckets: Record<
		Exclude<SystemRoleKey, "owner" | "guest">,
		Set<Claim>
	> = {
		manager: new Set(),
		editor: new Set(),
		reader: new Set(),
	};
	for (const m of manifests) {
		if (!m.roleDefaults) continue;
		for (const [key, claims] of Object.entries(m.roleDefaults)) {
			if (key === "owner" || key === "guest") continue;
			const bucket = buckets[key as Exclude<SystemRoleKey, "owner" | "guest">];
			if (!bucket || !claims) continue;
			for (const c of claims) bucket.add(c as Claim);
		}
	}
	return {
		owner,
		manager: buckets.manager,
		editor: buckets.editor,
		reader: buckets.reader,
		guest,
	};
}

/**
 * Seed the five system roles on workspace creation. Idempotent (does
 * nothing if the workspace already has any roles). Returns the ids in
 * declaration order so the caller can wire the creator's assignment.
 */
export async function seedWorkspaceRoles(
	db: Kysely<IdentityDB>,
	workspaceId: string,
	catalog: ReadonlySet<Claim>,
	manifests: readonly PluginManifest[],
): Promise<Record<SystemRoleKey, string>> {
	const existing = await db
		.selectFrom("roles")
		.select("id")
		.where("workspace_id", "=", workspaceId)
		.executeTakeFirst();
	if (existing) {
		const rows = await db
			.selectFrom("roles")
			.select(["id", "key"])
			.where("workspace_id", "=", workspaceId)
			.execute();
		return mapSystemRoleIds(rows);
	}

	const claims = systemRoleClaims(catalog, manifests);
	const ids = {} as Record<SystemRoleKey, string>;
	for (const key of SYSTEM_ROLE_KEYS) {
		const id = newId("rol");
		ids[key] = id;
		await db
			.insertInto("roles")
			.values({
				id,
				workspace_id: workspaceId,
				name: titleCase(key),
				key,
				description: SYSTEM_ROLE_DESCRIPTIONS[key],
				is_system: true,
			})
			.execute();
		const set = claims[key];
		for (const claim of set) {
			await db
				.insertInto("role_claims")
				.values({ role_id: id, claim })
				.execute();
		}
	}
	return ids;
}

const SYSTEM_ROLE_DESCRIPTIONS: Record<SystemRoleKey, string> = {
	owner:
		"Full control of this workspace: everything the claim catalog permits.",
	manager: "Member and role management, plus the editor/reader powers.",
	editor: "Create and edit content in this workspace.",
	reader: "Read access. Edits and member changes are denied.",
	guest:
		"Inherits no claims from roles — see entity grants (task 6) for access.",
};

function titleCase(key: SystemRoleKey): string {
	return key[0]!.toUpperCase() + key.slice(1);
}

function mapSystemRoleIds(
	rows: { id: string; key: string }[],
): Record<SystemRoleKey, string> {
	const out = {} as Record<SystemRoleKey, string>;
	for (const r of rows) out[r.key as SystemRoleKey] = r.id;
	return out;
}

/**
 * Reconcile one plugin's effect on a workspace's system roles. Used at
 * install/disable/upgrade time (task-05 §5.3). The function touches ONLY
 * the system roles' role_claims rows; it never inserts a custom role or
 * removes anything from one. Returns the list of mutations for the bus
 * to re-emit as facts.
 */
export interface ReconcileMutation {
	role: SystemRoleKey;
	claim: string;
	op: "added" | "removed";
}

export interface InstalledPluginSnapshot {
	id: PluginId;
	permissions: readonly Claim[];
	roleDefaults: PluginManifest["roleDefaults"];
}

export async function reconcileWorkspaceRoles(
	db: Kysely<IdentityDB>,
	workspaceId: string,
	plugin: InstalledPluginSnapshot,
	direction: "install" | "disable" | "upgrade",
	prev?: InstalledPluginSnapshot,
): Promise<ReconcileMutation[]> {
	const mutations: ReconcileMutation[] = [];
	const systemRoles = await loadSystemRoleIds(db, workspaceId);
	if (!systemRoles) return [];

	if (direction === "install" || direction === "upgrade") {
		for (const claim of plugin.permissions) {
			await insertRoleClaim(db, systemRoles.owner, claim);
			mutations.push({ role: "owner", claim, op: "added" });
		}
		for (const [key, claims] of Object.entries(plugin.roleDefaults ?? {})) {
			const role = systemRoles[key as SystemRoleKey];
			if (!role) continue;
			for (const claim of claims ?? []) {
				await insertRoleClaim(db, role, claim);
				mutations.push({ role: key as SystemRoleKey, claim, op: "added" });
			}
		}
	}

	if (direction === "disable") {
		for (const claim of plugin.permissions) {
			await deleteRoleClaim(db, systemRoles.owner, claim);
			mutations.push({ role: "owner", claim, op: "removed" });
		}
		for (const [key, claims] of Object.entries(plugin.roleDefaults ?? {})) {
			const role = systemRoles[key as SystemRoleKey];
			if (!role) continue;
			for (const claim of claims ?? []) {
				await deleteRoleClaim(db, role, claim);
				mutations.push({ role: key as SystemRoleKey, claim, op: "removed" });
			}
		}
	}

	if (direction === "upgrade") {
		const newDefaults = normalizeDefaults(plugin.roleDefaults);
		const oldDefaults = normalizeDefaults(prev?.roleDefaults);
		for (const [key, claims] of Object.entries(oldDefaults)) {
			const role = systemRoles[key as SystemRoleKey];
			if (!role) continue;
			for (const claim of new Set(claims)) {
				if (!new Set(newDefaults[key] ?? []).has(claim)) {
					await deleteRoleClaim(db, role, claim);
					mutations.push({ role: key as SystemRoleKey, claim, op: "removed" });
				}
			}
		}
	}

	return mutations;
}

function normalizeDefaults(
	defs: PluginManifest["roleDefaults"],
): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	if (!defs) return out;
	for (const [k, v] of Object.entries(defs)) out[k] = [...(v ?? [])];
	return out;
}

async function loadSystemRoleIds(
	db: Kysely<IdentityDB>,
	workspaceId: string,
): Promise<Record<SystemRoleKey, string> | null> {
	const rows = await db
		.selectFrom("roles")
		.select(["id", "key"])
		.where("workspace_id", "=", workspaceId)
		.where("is_system", "=", true)
		.execute();
	if (rows.length === 0) return null;
	return mapSystemRoleIds(rows);
}

async function insertRoleClaim(
	db: Kysely<IdentityDB>,
	roleId: string,
	claim: Claim,
): Promise<void> {
	await db
		.insertInto("role_claims")
		.values({ role_id: roleId, claim })
		.onConflict((oc) => oc.doNothing())
		.execute();
}

async function deleteRoleClaim(
	db: Kysely<IdentityDB>,
	roleId: string,
	claim: string,
): Promise<void> {
	await db
		.deleteFrom("role_claims")
		.where("role_id", "=", roleId)
		.where("claim", "=", claim)
		.execute();
}

/**
 * Mark whether each claim a role holds is still in the live catalog.
 * Dangling claims are inert in evaluation (task-04 resolves through the
 * catalog) but surfaced here so the UI can warn — plan §3.
 */
export function annotateDangling(
	claims: readonly Claim[],
	catalog: ReadonlySet<Claim>,
): { claim: Claim; dangling: boolean }[] {
	return claims.map((c) => ({ claim: c, dangling: !catalog.has(c) }));
}
