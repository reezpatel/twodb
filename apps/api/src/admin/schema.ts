import type { Generated } from "kysely";

declare module "@twodb/shared-backend" {
  export interface InstanceTable {
    id: string;
    name: string;
    logo: string | null;
    created_at: Generated<Date>;
  }

  export interface AdminPasskeysTable {
    id: string;
    credential_id: string;
    public_key: Buffer;
    counter: Generated<number>;
    transports: string | null;
    name: Generated<string>;
    created_at: Generated<Date>;
    last_used_at: Date | null;
  }

  export interface AdminSessionsTable {
    token_hash: string;
    created_at: Generated<Date>;
    expires_at: Date;
  }

  export interface PluginsTable {
    identifier: string;
    name: string | null;
    extracted_path: string | null;
    version: string | null;
    provides: Generated<string[] | string>;
    manifest: Record<string, unknown> | null;
    config: Record<string, unknown> | null;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
  }

  export interface PluginTemplatesTable {
    identifier: string;
    name: string | null;
    extracted_path: string | null;
    version: string | null;
    provides: Generated<string>;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
  }

  export interface SchemaMigrationsTable {
    name: string;
    applied_at: Generated<Date>;
  }

  interface TwodbDatabase {
    admin_instance: InstanceTable;
    admin_passkeys: AdminPasskeysTable;
    admin_sessions: AdminSessionsTable;
    admin_plugins: PluginsTable;
    admin_plugin_templates: PluginTemplatesTable;
    admin_schema_migrations: SchemaMigrationsTable;
  }
}
