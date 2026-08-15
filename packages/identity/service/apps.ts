import { randomBytes } from "node:crypto";
import type { Kysely } from "kysely";
import type { Claim } from "@twodb/contracts";
import type { IdentityDB } from "./schema";

const APP_SYSTEM_ROLE_KEYS = [
	"owner",
	"manager",
	"editor",
	"reader",
	"guest",
] as const;
export type AppRoleKey = (typeof APP_SYSTEM_ROLE_KEYS)[number];

export function isAppRoleKey(value: string): value is AppRoleKey {
	return (APP_SYSTEM_ROLE_KEYS as readonly string[]).includes(value);
}

export function isAppClaim(claim: string): boolean {
	return /^app\.[a-z][a-z0-9]*(\.[a-z0-9]+)*:[a-z]/.test(claim);
}

/**
 * Seed the five system app roles for a freshly-created app.
 * Pure-shape: caller passes the catalog and the app's permissions and
 * roleDefaults (parsed from the manifest). Mirrors the workspace seed
 * function but at the app level (task-07 §7.3).
 */
export function appRoleClaims(
	appPermissions: readonly Claim[],
	roleDefaults: { manager?: readonly Claim[]; editor?: readonly Claim[]; reader?: readonly Claim[] },
): Record<AppRoleKey, ReadonlySet<Claim>> {
	const owner = new Set<Claim>(appPermissions);
	const guest = new Set<Claim>();
	const buckets: Record<Exclude<AppRoleKey, "owner" | "guest">, Set<Claim>> = {
		manager: new Set(roleDefaults.manager ?? []),
		editor: new Set(roleDefaults.editor ?? []),
		reader: new Set(roleDefaults.reader ?? []),
	};
	return {
		owner,
		manager: buckets.manager,
		editor: buckets.editor,
		reader: buckets.reader,
		guest,
	};
}

export async function seedAppRoles(
	db: Kysely<IdentityDB>,
	appId: string,
	permissions: readonly Claim[],
	roleDefaults: { manager?: readonly Claim[]; editor?: readonly Claim[]; reader?: readonly Claim[] },
): Promise<Record<AppRoleKey, string>> {
	const claims = appRoleClaims(permissions, roleDefaults);
	const ids = {} as Record<AppRoleKey, string>;
	for (const key of APP_SYSTEM_ROLE_KEYS) {
		const id = `aro-${randomBytes(8).toString("base64url")}`;
		ids[key] = id;
		await db
			.insertInto("app_roles")
			.values({
				id,
				app_id: appId,
				key,
				name: key[0]!.toUpperCase() + key.slice(1),
				description: APP_ROLE_DESCRIPTIONS[key],
				is_system: true,
			})
			.execute();
		for (const claim of claims[key]) {
			await db
				.insertInto("app_role_claims")
				.values({ app_role_id: id, claim })
				.execute();
		}
	}
	return ids;
}

const APP_ROLE_DESCRIPTIONS: Record<AppRoleKey, string> = {
	owner: "Full control of this app — every claim it owns.",
	manager: "Manage app roles and entries; reader/editor powers included.",
	editor: "Create and edit entries in this app.",
	reader: "Read entries; no edits.",
	guest: "No claims; access comes from entity grants on the app.",
};

/**
 * Compute the principal's effective claims for one app.
 *   implicit app-owner → all app permissions;
 *   else app-role claims ∪ entity_grants where entity_type='app'.
 */
export async function effectiveAppClaims(
	db: Kysely<IdentityDB>,
	userId: string,
	appId: string,
	appWorkspaceId: string,
	appPermissions: readonly Claim[],
): Promise<ReadonlySet<Claim>> {
	const held = new Set<Claim>();
	const ownerGrant = await isAppOwnerImplicit(
		db,
		userId,
		appWorkspaceId,
	);
	if (ownerGrant) {
		for (const c of appPermissions) held.add(c);
		return held;
	}
	const assignments = await db
		.selectFrom("app_role_assignments")
		.innerJoin(
			"app_role_claims",
			"app_role_claims.app_role_id",
			"app_role_assignments.app_role_id",
		)
		.select("app_role_claims.claim")
		.where("app_role_assignments.app_id", "=", appId)
		.where("app_role_assignments.user_id", "=", userId)
		.execute();
	for (const a of assignments) held.add(a.claim as Claim);
	const grants = await db
		.selectFrom("entity_grants")
		.select("claims")
		.where("entity_type", "=", "app")
		.where("entity_id", "=", appId)
		.where("user_id", "=", userId)
		.execute();
	for (const g of grants) for (const c of g.claims) held.add(c as Claim);
	return held;
}

async function isAppOwnerImplicit(
	db: Kysely<IdentityDB>,
	userId: string,
	workspaceId: string,
): Promise<boolean> {
	const rows = await db
		.selectFrom("workspace_role_assignments")
		.innerJoin(
			"roles",
			"roles.id",
			"workspace_role_assignments.role_id",
		)
		.select("roles.key")
		.where("workspace_role_assignments.workspace_id", "=", workspaceId)
		.where("workspace_role_assignments.user_id", "=", userId)
		.where("roles.key", "in", ["owner", "manager"])
		.execute();
	return rows.length > 0;
}
