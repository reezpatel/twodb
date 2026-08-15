import type { Claim } from "./claims";

export const SHARE_SLOT = "share" as const;

const SHARING_REGISTRY = new Map<string, Claim>();

export function registerSharingClaim(entityType: string, claim: Claim): void {
	SHARING_REGISTRY.set(entityType, claim);
}

export function sharingClaimFor(entityType: string): Claim | undefined {
	return SHARING_REGISTRY.get(entityType);
}

export function clearSharingRegistry(): void {
	SHARING_REGISTRY.clear();
}

export function listSharingClaims(): ReadonlyMap<string, Claim> {
	return SHARING_REGISTRY;
}
