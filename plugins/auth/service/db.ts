import { sql } from "kysely";
import type { Generated, Kysely } from "kysely";

// Plugin-scoped storage: every table lives in the io_twodb_auth postgres
// schema (host-created; see apps/api mountPlugin). These are USER
// credentials — separate from the admin passkeys the host keeps in its own
// sqlite db.

export interface AuthUsersTable {
  id: string;
  email: string;
  created_at: Generated<Date>;
}

export interface AuthUserPasskeysTable {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: Buffer;
  counter: Generated<number>;
  transports: string | null;
  name: Generated<string>;
  created_at: Generated<Date>;
  last_used_at: Date | null;
}

// Singleton row (id = 1) describing the configured auth process.
// Passkeys are the only enabled method by default.
export interface AuthConfigTable {
  id: number;
  passkeys_enabled: Generated<boolean>;
  google_sso_enabled: Generated<boolean>;
  google_client_id: Generated<string | null>;
  google_client_secret: Generated<string | null>;
  magic_link_enabled: Generated<boolean>;
  updated_at: Generated<Date>;
}

export interface AuthUserSessionsTable {
  token_hash: string;
  user_id: string;
  created_at: Generated<Date>;
  expires_at: Date;
}

export interface AuthDb {
  users: AuthUsersTable;
  user_passkeys: AuthUserPasskeysTable;
  auth_config: AuthConfigTable;
  user_sessions: AuthUserSessionsTable;
}

export const authMigrations = {
  "0001_init": {
    up: async (db: Kysely<unknown>) => {
      const d = db as unknown as Kysely<AuthDb>;
      const now = sql`now()`;

      await d.schema
        .createTable("auth_users")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("email", "text", (c) => c.notNull().unique())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
        .execute();

      await d.schema
        .createTable("auth_user_passkeys")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("user_id", "text", (c) => c.notNull().references("users.id"))
        .addColumn("credential_id", "text", (c) => c.notNull().unique())
        .addColumn("public_key", "bytea", (c) => c.notNull())
        .addColumn("counter", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("transports", "text")
        .addColumn("name", "text", (c) => c.notNull().defaultTo(""))
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
        .addColumn("last_used_at", "timestamptz")
        .execute();

      await d.schema
        .createTable("auth_auth_config")
        .addColumn("id", "integer", (c) => c.primaryKey())
        .addColumn("passkeys_enabled", "boolean", (c) => c.notNull().defaultTo(true))
        .addColumn("google_sso_enabled", "boolean", (c) => c.notNull().defaultTo(false))
        .addColumn("google_client_id", "text")
        .addColumn("google_client_secret", "text")
        .addColumn("magic_link_enabled", "boolean", (c) => c.notNull().defaultTo(false))
        .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(now))
        .execute();

      await d.insertInto("auth_config").values({ id: 1 }).execute();

      await d.schema
        .createTable("auth_user_sessions")
        .addColumn("token_hash", "text", (c) => c.primaryKey())
        .addColumn("user_id", "text", (c) => c.notNull().references("users.id"))
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
        .addColumn("expires_at", "timestamptz", (c) => c.notNull())
        .execute();
    },
    down: async (db: Kysely<unknown>) => {
      const d = db as unknown as Kysely<AuthDb>;
      await d.schema.dropTable("user_sessions").execute();
      await d.schema.dropTable("auth_config").execute();
      await d.schema.dropTable("user_passkeys").execute();
      await d.schema.dropTable("users").execute();
    },
  },
};
