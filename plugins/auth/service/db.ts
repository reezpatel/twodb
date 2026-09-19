import { sql } from "kysely";
import type { Generated, Kysely } from "kysely";
import type { TwodbDatabase } from "@twodb/shared-backend";

declare module "@twodb/shared-backend" {
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

  export interface AuthUserSessionsTable {
    token_hash: string;
    user_id: string;
    created_at: Generated<Date>;
    expires_at: Date;
  }

  interface TwodbDatabase {
    auth_users: AuthUsersTable;
    auth_user_passkeys: AuthUserPasskeysTable;
    auth_user_sessions: AuthUserSessionsTable;
  }
}

export const authMigrations = {
  "0001_init": {
    up: async (db: Kysely<TwodbDatabase>) => {
      const now = sql`now()`;

      await db.schema
        .createTable("auth_users")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("email", "text", (c) => c.notNull().unique())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
        .execute();

      await db.schema
        .createTable("auth_user_passkeys")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("user_id", "text", (c) => c.notNull().references("auth_users.id"))
        .addColumn("credential_id", "text", (c) => c.notNull().unique())
        .addColumn("public_key", "bytea", (c) => c.notNull())
        .addColumn("counter", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("transports", "text")
        .addColumn("name", "text", (c) => c.notNull().defaultTo(""))
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
        .addColumn("last_used_at", "timestamptz")
        .execute();

      await db.schema
        .createTable("auth_user_sessions")
        .addColumn("token_hash", "text", (c) => c.primaryKey())
        .addColumn("user_id", "text", (c) => c.notNull().references("auth_users.id"))
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
        .addColumn("expires_at", "timestamptz", (c) => c.notNull())
        .execute();
    },
    down: async (db: Kysely<TwodbDatabase>) => {
      await db.schema.dropTable("auth_user_sessions").execute();
      await db.schema.dropTable("auth_user_passkeys").execute();
      await db.schema.dropTable("auth_users").execute();
    },
  },
};
