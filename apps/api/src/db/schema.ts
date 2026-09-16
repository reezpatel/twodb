import type { Generated } from "kysely";

// Row shapes for the api-owned sqlite database (db-v1.sqlite). Tables are
// created by src/db/migrations/*.sql — keep this file in sync with them.
// JSON columns (provides, transports, manifest, config) are TEXT at the
// storage level; parse/stringify at the boundary.

export interface InstanceTable {
	id: string;
	name: string;
	logo: string | null;
	created_at: Generated<string>;
}

export interface AdminPasskeysTable {
	id: string;
	credential_id: string;
	public_key: Uint8Array;
	counter: Generated<number>;
	transports: string | null;
	name: Generated<string>;
	created_at: Generated<string>;
	last_used_at: string | null;
}

export interface AdminSessionsTable {
	token_hash: string;
	created_at: Generated<string>;
	expires_at: string;
}

export interface PluginsTable {
	identifier: string;
	name: string | null;
	extracted_path: string | null;
	version: string | null;
	provides: Generated<string>;
	manifest: string | null;
	config: string | null;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface PluginTemplatesTable {
	identifier: string;
	name: string | null;
	extracted_path: string | null;
	version: string | null;
	provides: Generated<string>;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface SchemaMigrationsTable {
	name: string;
	applied_at: Generated<string>;
}

export interface Database {
	instance: InstanceTable;
	admin_passkeys: AdminPasskeysTable;
	admin_sessions: AdminSessionsTable;
	plugins: PluginsTable;
	plugin_templates: PluginTemplatesTable;
	schema_migrations: SchemaMigrationsTable;
}
