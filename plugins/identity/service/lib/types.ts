import { isPluginId, type Claim } from "@twodb/contracts";

export interface Principal {
	userId: string;
	isSuperadmin: boolean;
}

export type PluginId = string;

export interface PluginManifest {
	id: PluginId;
	name: string;
	version: string;
	provides?: { functions: unknown[]; routes: unknown[] };
	emits?: readonly string[];
	consumes?: readonly string[];
	permissions: readonly Claim[];
	roleDefaults?: Partial<Record<string, readonly Claim[]>>;
}

export function sharingClaimFor(entityType: string): Claim | undefined {
	return isPluginId(entityType)
		? (`plugin.${entityType}:share` as Claim)
		: undefined;
}
