import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("runner_access_key")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("key", "text", (c) => c.notNull().unique())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("revokedAt", "timestamptz")
    .execute();

  await db.schema
    .createTable("runner")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("accessKeyId", "text", (c) => c.notNull().references("runner_access_key.id"))
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("hostname", "text")
    .addColumn("lastSeenAt", "timestamptz", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("deletedAt", "timestamptz")
    .execute();

  await db.schema.createIndex("runner_organization_idx").on("runner").column("organizationId").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("runner").execute();
  await db.schema.dropTable("runner_access_key").execute();
}
