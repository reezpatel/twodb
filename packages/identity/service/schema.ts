import type { Generated } from "kysely";

export type IdentifierMode = "email" | "phone" | "email+phone";

export interface UsersTable {
	id: string;
	identifier: string;
	email: string | null;
	phone: string | null;
	name: string;
	password_hash: string;
	email_verified_at: Date | null;
	phone_verified_at: Date | null;
	created_at: Generated<Date>;
}

export interface SessionsTable {
	id: string;
	user_id: string;
	token_hash: string;
	auth_method: string;
	expires_at: Date;
	created_at: Generated<Date>;
}

export interface PlatformAdminsTable {
	user_id: string;
	granted_by: string | null;
	created_at: Generated<Date>;
}

export interface OrganizationsTable {
	id: string;
	name: string;
	slug: string;
	created_by: string;
	created_at: Generated<Date>;
}

export interface OrgMembershipsTable {
	org_id: string;
	user_id: string;
	is_admin: boolean;
	created_at: Generated<Date>;
}

export interface WorkspacesTable {
	id: string;
	org_id: string;
	name: string;
	slug: string;
	created_at: Generated<Date>;
}

export interface WorkspaceMembersTable {
	workspace_id: string;
	user_id: string;
	created_at: Generated<Date>;
}

export interface IdentityDB {
	users: UsersTable;
	sessions: SessionsTable;
	platform_admins: PlatformAdminsTable;
	organizations: OrganizationsTable;
	org_memberships: OrgMembershipsTable;
	workspaces: WorkspacesTable;
	workspace_members: WorkspaceMembersTable;
}
