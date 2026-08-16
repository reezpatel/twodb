import { isClaim, type Claim } from "@twodb/contracts";
import { ROLE_DEFAULT_KEYS } from "@twodb/contracts";

export type PluginId = string;

export interface PluginManifest {
	id: PluginId;
	name: string;
	version: string;
	permissions: readonly Claim[];
	roleDefaults?: Partial<Record<string, readonly Claim[]>>;
}

export interface ClaimCatalog {
	readonly all: Set<Claim>;
	readonly byPlugin: ReadonlyMap<PluginId, ReadonlySet<Claim>>;
	readonly roleDefaults: ReadonlyMap<
		PluginId,
		Partial<Record<(typeof ROLE_DEFAULT_KEYS)[number], readonly Claim[]>>
	>;
}

export async function buildClaimCatalog(
	manifests: readonly PluginManifest[],
): Promise<ClaimCatalog> {
	const all = new Set<Claim>();
	const byPlugin = new Map<PluginId, Set<Claim>>();
	const roleDefaults = new Map<
		PluginId,
		Partial<Record<(typeof ROLE_DEFAULT_KEYS)[number], Claim[]>>
	>();

	for (const m of manifests) {
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
			const rd: Partial<Record<(typeof ROLE_DEFAULT_KEYS)[number], Claim[]>> =
				{};
			for (const role of ROLE_DEFAULT_KEYS) {
				const list = m.roleDefaults[role];
				if (!list) continue;
				for (const claim of list) {
					if (!own.has(claim)) {
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
