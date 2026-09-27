import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("device")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("userId", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .addColumn("name", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("platform", "text", (c) => c.notNull()) // ios | android | web
    .addColumn("token", "text", (c) => c.notNull().unique())
    .addColumn("lastSeenAt", "timestamptz", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("device_user_idx").on("device").column("userId").execute();

  await db.schema
    .createTable("notification")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("userId", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("body", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("data", "jsonb")
    .addColumn("readAt", "timestamptz")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("notification_user_idx").on("notification").columns(["userId", "createdAt"]).execute();
  await db.schema.createIndex("notification_org_idx").on("notification").column("organizationId").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("notification").execute();
  await db.schema.dropTable("device").execute();
}
