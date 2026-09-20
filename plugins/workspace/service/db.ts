import { sql } from "kysely";
import type { Generated, Kysely } from "kysely";
import type { TwodbDatabase } from "@twodb/shared-backend";

declare module "@twodb/shared-backend" {
  export interface WsVaultsTable {
    id: string;
    owner_id: string;
    name: string;
    created_at: Generated<Date>;
  }

  export interface WsWorkspacesTable {
    id: string;
    vault_id: string;
    name: string;
    created_at: Generated<Date>;
  }

  interface TwodbDatabase {
    ws_vaults: WsVaultsTable;
    ws_workspaces: WsWorkspacesTable;
  }
}

export const workspaceMigrations = {
  "0001_init": {
    up: async (db: Kysely<TwodbDatabase>) => {
      const now = sql`now()`;

      await db.schema
        .createTable("ws_vaults")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("owner_id", "text", (c) => c.notNull())
        .addColumn("name", "text", (c) => c.notNull())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
        .execute();

      await db.schema
        .createTable("ws_workspaces")
        .addColumn("id", "text", (c) => c.primaryKey())
        .addColumn("vault_id", "text", (c) => c.notNull().references("ws_vaults.id"))
        .addColumn("name", "text", (c) => c.notNull())
        .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
        .execute();
    },
    down: async (db: Kysely<TwodbDatabase>) => {
      await db.schema.dropTable("ws_workspaces").execute();
      await db.schema.dropTable("ws_vaults").execute();
    },
  },
};
