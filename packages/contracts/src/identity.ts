import type { Claim } from "./claims";

export interface IdentityUser {
	id: string;
	name: string;
}

export interface IdentityOrganization {
	id: string;
	name: string;
}

export interface IdentityWorkspace {
	id: string;
	name: string;
	roles: string;
	claims: Claim[];
	organization: IdentityOrganization;
}

export interface IdentityContext {
	user?: IdentityUser;
	workspaces?: IdentityWorkspace[];
	activeWorkspace?: IdentityWorkspace;
	switchWorkspace: (workspaceId: string) => void;
	refetch: () => Promise<void>;
	signOut: () => Promise<void>;
}

// export interface IdentitySnapshot {
//   user: IdentityUser | null;
//   workspaces: IdentityWorkspace[];
//   activeWorkspaceId: string | null;
//   roles: string[];
//   claims: Claim[];
// }

// export interface Identity {
//   status: IdentityStatus;
//   userId: string | null;
//   userName: string | null;
//   accountId: string | null;
//   workspaceId: string | null;
//   workspaces: IdentityWorkspace[];
//   activeWorkspace: IdentityWorkspace | null;
//   roles: string[];
//   claims: Claim[];
//   hasClaim(claim: Claim): boolean;
//   switchWorkspace(workspaceId: string): void;
//   refetch(): Promise<void>;
//   signOut(): Promise<void>;
// }

// export interface Principal {
//   userId: string;
//   isSuperadmin: boolean;
// }
