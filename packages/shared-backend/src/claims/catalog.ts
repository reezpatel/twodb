import {
	isClaim,
	ROLE_DEFAULT_KEYS,
	validateManifest,
	type Claim,
	type PluginId,
	type PluginManifest,
	type RoleDefaultKey,
} from "@twodb/contracts";

export interface ClaimCatalog {
	readonly all: Set<Claim>;
	readonly byPlugin: ReadonlyMap<PluginId, ReadonlySet<Claim>>;
	readonly roleDefaults: ReadonlyMap<
		PluginId,
		Partial<Record<RoleDefaultKey, readonly Claim[]>>
	>;
}

export async function buildClaimCatalog(
	manifests: readonly PluginManifest[],
): Promise<ClaimCatalog> {
	const all = new Set<Claim>();
	// Set is mutable at runtime — apps register / unregister their
	// app.* claims here as they are created / deleted. Plugins take
	// a Readonly view via the byPlugin map.
	const byPlugin = new Map<PluginId, Set<Claim>>();
	const roleDefaults = new Map<
		PluginId,
		Partial<Record<RoleDefaultKey, Claim[]>>
	>();

	for (const m of manifests) {
		const problems = validateManifest(m);
		if (problems.length > 0) {
			throw new Error(
				`twodb: manifest "${m.id}" is invalid:\n  - ${problems.join("\n  - ")}`,
			);
		}
		const own = new Set<Claim>();
		for (const claim of m.permissions) {
			if (!isClaim(claim)) {
				throw new Error(
					`twodb: plugin "${m.id}" declares an invalid claim "${claim}"`,
				);
			}
			own.add(claim);
			all.add(claim);
		}
		byPlugin.set(m.id, own);

		if (m.roleDefaults) {
			const rd: Partial<Record<RoleDefaultKey, Claim[]>> = {};
			for (const role of ROLE_DEFAULT_KEYS) {
				const list = m.roleDefaults[role];
				if (!list) continue;
				for (const claim of list) {
					if (!own.has(claim as Claim)) {
						throw new Error(
							`twodb: plugin "${m.id}" roleDefaults.${role} references undeclared claim "${claim}" — add it to permissions first.`,
						);
					}
				}
				rd[role] = [...list] as Claim[];
			}
			roleDefaults.set(m.id, rd);
		}
	}
	return { all, byPlugin, roleDefaults };
}

export function claimOwner(claim: Claim): PluginId {
	const colon = claim.indexOf(":");
	return claim.slice(0, colon).replace(/^plugin\.|^app\./, "");
}

export function danglingClaims(
	catalog: ClaimCatalog,
	enabledPluginIds: ReadonlySet<PluginId>,
): Claim[] {
	const result: Claim[] = [];
	for (const claim of catalog.all) {
		if (!enabledPluginIds.has(claimOwner(claim))) {
			result.push(claim);
		}
	}
	return result;
}
