import os from "node:os";
import { newId } from "@twodb/shared-backend";
import { sql, type Kysely } from "kysely";
import type { TwodbDatabase } from "@twodb/shared-backend";

export default {
  up: async (db: Kysely<TwodbDatabase>) => {
    const now = sql`now()`;

    await db.schema
      .createTable("admin_instance")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("name", "text", (c) => c.notNull())
      .addColumn("logo", "text")
      .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
      .execute();

    await db
      .insertInto("admin_instance")
      .values({ id: newId("inst"), name: os.hostname() })
      .execute();

    await db.schema
      .createTable("admin_passkeys")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("credential_id", "text", (c) => c.notNull().unique())
      .addColumn("public_key", "bytea", (c) => c.notNull())
      .addColumn("counter", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("transports", "text")
      .addColumn("name", "text", (c) => c.notNull().defaultTo(""))
      .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
      .addColumn("last_used_at", "timestamptz")
      .execute();

    await db.schema
      .createTable("admin_sessions")
      .ifNotExists()
      .addColumn("token_hash", "text", (c) => c.primaryKey())
      .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
      .addColumn("expires_at", "timestamptz", (c) => c.notNull())
      .execute();

    await db.schema
      .createTable("admin_plugins")
      .ifNotExists()
      .addColumn("identifier", "text", (c) => c.primaryKey())
      .addColumn("name", "text")
      .addColumn("extracted_path", "text")
      .addColumn("version", "text")
      .addColumn("provides", "text", (c) => c.notNull().defaultTo("[]"))
      .addColumn("manifest", "text")
      .addColumn("config", "text")
      .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
      .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(now))
      .execute();

    await db.schema
      .createTable("admin_plugin_templates")
      .ifNotExists()
      .addColumn("identifier", "text", (c) => c.primaryKey())
      .addColumn("name", "text")
      .addColumn("extracted_path", "text")
      .addColumn("version", "text")
      .addColumn("provides", "text", (c) => c.notNull().defaultTo("[]"))
      .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
      .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(now))
      .execute();
  },
  down: async (db: Kysely<TwodbDatabase>) => {
    await db.schema.dropTable("admin_plugin_templates").ifExists().execute();
    await db.schema.dropTable("admin_plugins").ifExists().execute();
    await db.schema.dropTable("admin_sessions").ifExists().execute();
    await db.schema.dropTable("admin_passkeys").ifExists().execute();
    await db.schema.dropTable("admin_instance").ifExists().execute();
  },
};
