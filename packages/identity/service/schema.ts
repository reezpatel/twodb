import type { Generated } from "kysely";

export type IdentifierMode = "email" | "phone" | "email+phone";

export interface UsersTable {
	id: string;
	identifier: string;
	email: string | null;
	phone: string | null;
	name: string;
	email_verified_at: Date | null;
	phone_verified_at: Date | null;
	created_at: Generated<Date>;
}

/** password → { hash }; sso.<provider> → { issuer, subject }; link/otp → {} */
export interface AuthCredential {
	hash?: string;
	issuer?: string;
	subject?: string;
}

export interface UserAuthMethodsTable {
	id: string;
	user_id: string;
	method: string;
	credential: AuthCredential;
	enabled: Generated<boolean>;
	created_at: Generated<Date>;
}

/** Config for sso.<provider> rows; empty object for the built-in methods. */
export interface DeploymentMethodConfig {
	clientId?: string;
	clientSecret?: string;
	issuer?: string;
	authorizationEndpoint?: string;
	tokenEndpoint?: string;
	userinfoEndpoint?: string;
}

export interface DeploymentAuthMethodsTable {
	method: string;
	config: DeploymentMethodConfig;
	enabled: Generated<boolean>;
}

export interface VerificationCodesTable {
	id: string;
	identifier: string;
	code_hash: string;
	purpose: string;
	attempts: Generated<number>;
	expires_at: Date;
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

export interface RolesTable {
	id: string;
	workspace_id: string;
	key: string;
	name: string;
	description: string | null;
	is_system: Generated<boolean>;
	created_at: Generated<Date>;
}

export interface RoleClaimsTable {
	role_id: string;
	claim: string;
}

export interface WorkspaceRoleAssignmentsTable {
	id: string;
	workspace_id: string;
	user_id: string;
	role_id: string;
	assigned_by: string | null;
	assigned_at: Generated<Date>;
	created_at: Generated<Date>;
}

export interface EntityGrantsTable {
	id: string;
	workspace_id: string;
	user_id: string;
	entity_type: string;
	entity_id: string;
	claims: string[];
	granted_by: string | null;
	created_at: Generated<Date>;
}

export interface IdentityDB {
	users: UsersTable;
	user_auth_methods: UserAuthMethodsTable;
	deployment_auth_methods: DeploymentAuthMethodsTable;
	verification_codes: VerificationCodesTable;
	sessions: SessionsTable;
	platform_admins: PlatformAdminsTable;
	organizations: OrganizationsTable;
	org_memberships: OrgMembershipsTable;
	workspaces: WorkspacesTable;
	workspace_members: WorkspaceMembersTable;
	roles: RolesTable;
	role_claims: RoleClaimsTable;
	workspace_role_assignments: WorkspaceRoleAssignmentsTable;
	entity_grants: EntityGrantsTable;
	apps: AppsTable;
	app_roles: AppRolesTable;
	app_role_claims: AppRoleClaimsTable;
	app_role_assignments: AppRoleAssignmentsTable;
}

export interface AppsTable {
	id: string;
	workspace_id: string;
	slug: string;
	name: string;
	manifest: Record<string, unknown>;
	created_at: Generated<Date>;
}

export interface AppRolesTable {
	id: string;
	app_id: string;
	key: string;
	name: string;
	description: string | null;
	is_system: Generated<boolean>;
	created_at: Generated<Date>;
}

export interface AppRoleClaimsTable {
	app_role_id: string;
	claim: string;
}

export interface AppRoleAssignmentsTable {
	id: string;
	app_id: string;
	user_id: string;
	app_role_id: string;
	assigned_by: string | null;
	created_at: Generated<Date>;
}
