import type { Claim } from "./claims";

export type IdentityStatus = "loading" | "signed_out" | "unverified" | "ready";

export interface IdentityUser {
	id: string;
	name: string;
}

export interface IdentityWorkspace {
	id: string;
	orgId: string;
	name: string;
	orgName: string;
}

export interface IdentitySnapshot {
	user: IdentityUser | null;
	workspaces: IdentityWorkspace[];
	activeWorkspaceId: string | null;
	roles: string[];
	claims: Claim[];
}

export interface Identity {
	status: IdentityStatus;
	userId: string | null;
	userName: string | null;
	accountId: string | null;
	workspaceId: string | null;
	workspaces: IdentityWorkspace[];
	activeWorkspace: IdentityWorkspace | null;
	roles: string[];
	claims: Claim[];
	hasClaim(claim: Claim): boolean;
	switchWorkspace(workspaceId: string): void;
	refetch(): Promise<void>;
	signOut(): Promise<void>;
}

export interface Principal {
	userId: string;
	isSuperadmin: boolean;
}
