import { isClaim, type Claim } from "@twodb/contracts";

export interface IdentityClaimCatalog {
	all: Set<Claim>;
}

export function buildIdentityClaimCatalog(
	permissions: { permission: string }[],
): IdentityClaimCatalog {
	const all = new Set<Claim>();
	for (const { permission } of permissions) {
		if (!isClaim(permission)) {
			throw new Error(
				`twodb.identity: manifest declares invalid claim "${permission}"`,
			);
		}
		all.add(permission);
	}
	return { all };
}
