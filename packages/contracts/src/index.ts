/**
 * @twodb/contracts — the single source of truth for every cross-boundary
 * message in twodb. Pure types plus tiny runtime helpers — no runtime
 * dependencies, so both halves of every plugin (and both hosts) can import
 * it freely without bundle contamination.
 */

export {
	PLUGIN_CLAIM_PATTERN,
	APP_CLAIM_PATTERN,
	isPluginClaim,
	isAppClaim,
	isClaim,
	type PluginClaim,
	type AppClaim,
	type Claim,
} from "./claims";
export {
	DEFAULT_ROLE_KEYS,
	ROLE_DEFAULT_KEYS,
	isDefaultRoleKey,
	type DefaultRoleKey,
	type RoleDefaultKey,
} from "./roles";
export {
	ENTITY_ID_PATTERN,
	ID_PREFIXES,
	isEntityId,
	type IdPrefix,
} from "./ids";
export {
	PROVIDER_SLOTS,
	REQUIRED_PROVIDER_SLOTS,
	isProviderSlot,
	type ProviderSlot,
} from "./providers";
export {
	SHARE_SLOT,
	registerSharingClaim,
	sharingClaimFor,
	listSharingClaims,
	clearSharingRegistry,
} from "./sharing";
export type * from "./identity";
export type { EventsFor, MergeEventMaps } from "./events";

import { isClaim, type Claim } from "./claims";
import { ROLE_DEFAULT_KEYS, type RoleDefaultKey } from "./roles";
import { isProviderSlot, type ProviderSlot } from "./providers";

export type PluginId = string;

export const SESSION_COOKIE = "twodb_session";

export const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z0-9]+)*$/;

export function isPluginId(value: string): value is PluginId {
	return PLUGIN_ID_PATTERN.test(value);
}

export function apiPrefix(id: PluginId): string {
	return `/api/v1/${id}`;
}

export function viewPrefix(id: PluginId): string {
	return `/${id}`;
}

export interface PluginManifest {
	id: PluginId;
	name: string;
	version: string;
	provides: {
		functions: string[];
		routes: string[];
	};
	emits: string[];
	consumes: string[];
	permissions: Claim[];
	roleDefaults?: Partial<Record<RoleDefaultKey, Claim[]>>;
	provider?: ProviderSlot;
}

/** Returns a list of problems; empty means valid. Hosts refuse to boot on any. */
export function validateManifest(manifest: PluginManifest): string[] {
	const problems: string[] = [];
	if (!isPluginId(manifest.id)) {
		problems.push(`id "${manifest.id}" is not a valid plugin identifier`);
	}
	const declared = new Set<string>(manifest.permissions);
	for (const claim of manifest.permissions) {
		if (!isClaim(claim)) {
			problems.push(`permission "${claim}" is not a valid claim`);
		}
	}
	for (const [role, claims] of Object.entries(manifest.roleDefaults ?? {})) {
		if (!(ROLE_DEFAULT_KEYS as readonly string[]).includes(role)) {
			problems.push(
				`roleDefaults may not address "${role}" (owner is implicit, guest is always empty)`,
			);
			continue;
		}
		for (const claim of claims) {
			if (!declared.has(claim)) {
				problems.push(
					`roleDefaults.${role} references undeclared claim "${claim}"`,
				);
			}
		}
	}
	if (manifest.provider !== undefined && !isProviderSlot(manifest.provider)) {
		problems.push(`provider "${manifest.provider}" is not a known slot`);
	}
	return problems;
}

export interface BackendEventMap {
	"twodb.notes.note.created": { note: Note };
	"twodb.notes.note.updated": { note: Note };
	"twodb.notes.note.deleted": { noteId: string };
	"twodb.identity.user.created": { userId: string };
	"twodb.identity.session.started": { userId: string; authMethod: string };
	"twodb.identity.org.created": { orgId: string; ownerId: string };
	"twodb.identity.workspace.created": { workspaceId: string; orgId: string };
	"twodb.identity.workspace.member.added": {
		workspaceId: string;
		userId: string;
	};
	"twodb.identity.workspace.member.removed": {
		workspaceId: string;
		userId: string;
	};
	"twodb.identity.role.created": { workspaceId: string; roleId: string };
	"twodb.identity.role.assigned": {
		workspaceId: string;
		userId: string;
		roleId: string;
	};
	"twodb.identity.role.revoked": {
		workspaceId: string;
		userId: string;
		roleId: string;
	};
	"twodb.identity.entity.granted": {
		workspaceId: string;
		entityType: string;
		entityId: string;
		userId: string;
		claims: string[];
	};
	"twodb.identity.entity.revoked": {
		workspaceId: string;
		entityType: string;
		entityId: string;
		userId: string;
	};
	"twodb.identity.app.role.assigned": {
		appId: string;
		userId: string;
		appRoleId: string;
	};
	"twodb.identity.app.role.revoked": {
		appId: string;
		userId: string;
		appRoleId: string;
	};
	"twodb.identity.app.created": {
		appId: string;
		workspaceId: string;
	};
	"twodb.identity.app.deleted": {
		appId: string;
		workspaceId: string;
	};
	"twodb.identity.org.suspended": {
		orgId: string;
		suspended: boolean;
	};
	"twodb.identity.superadmin.promoted": {
		userId: string;
	};
	"twodb.identity.superadmin.demoted": {
		userId: string;
	};
	"twodb.identity.authmethod.configured": { method: string };
}

export interface FrontendEventMap {
	"twodb.notes.note.selected": { noteId: string };
	"twodb.shell.phase.changed": { phase: "day" | "night" };
}

export type AppEventMap = FrontendEventMap & BackendEventMap;

export interface CurrentUser {
	id: string;
	name: string;
}

export interface Note {
	id: string;
	title: string;
	body: string;
	createdAt: string;
	updatedAt: string;
}

export interface CreateNoteInput {
	title: string;
	body?: string;
}

export interface UpdateNoteInput {
	title?: string;
	body?: string;
}
