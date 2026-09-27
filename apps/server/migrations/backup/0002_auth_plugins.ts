import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // admin plugin
  await db.schema
    .alterTable("user")
    .addColumn("role", "text")
    .addColumn("banned", "boolean", (c) => c.defaultTo(false))
    .addColumn("banReason", "text")
    .addColumn("banExpires", "timestamptz")
    .execute();

  // admin (impersonatedBy) + organization (activeOrganizationId) plugins
  await db.schema.alterTable("session").addColumn("impersonatedBy", "text").addColumn("activeOrganizationId", "text").execute();

  // organization plugin
  await db.schema
    .createTable("organization")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("slug", "text", (c) => c.notNull().unique())
    .addColumn("logo", "text")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("metadata", "text")
    .execute();

  await db.schema
    .createTable("member")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id"))
    .addColumn("userId", "text", (c) => c.notNull().references("user.id"))
    .addColumn("role", "text", (c) => c.notNull().defaultTo("member"))
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("invitation")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id"))
    .addColumn("email", "text", (c) => c.notNull())
    .addColumn("role", "text")
    .addColumn("status", "text", (c) => c.notNull().defaultTo("pending"))
    .addColumn("expiresAt", "timestamptz", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("inviterId", "text", (c) => c.notNull().references("user.id"))
    .execute();

  // passkey plugin
  await db.schema
    .createTable("passkey")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("name", "text")
    .addColumn("publicKey", "text", (c) => c.notNull())
    .addColumn("userId", "text", (c) => c.notNull().references("user.id"))
    .addColumn("credentialID", "text", (c) => c.notNull())
    .addColumn("counter", "integer", (c) => c.notNull())
    .addColumn("deviceType", "text", (c) => c.notNull())
    .addColumn("backedUp", "boolean", (c) => c.notNull())
    .addColumn("transports", "text")
    .addColumn("createdAt", "timestamptz")
    .addColumn("aaguid", "text")
    .execute();

  // api-key plugin
  await db.schema
    .createTable("apikey")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("configId", "text", (c) => c.notNull().defaultTo("default"))
    .addColumn("name", "text")
    .addColumn("start", "text")
    .addColumn("referenceId", "text", (c) => c.notNull())
    .addColumn("prefix", "text")
    .addColumn("key", "text", (c) => c.notNull())
    .addColumn("refillInterval", "integer")
    .addColumn("refillAmount", "integer")
    .addColumn("lastRefillAt", "timestamptz")
    .addColumn("enabled", "boolean", (c) => c.defaultTo(true))
    .addColumn("rateLimitEnabled", "boolean", (c) => c.defaultTo(true))
    .addColumn("rateLimitTimeWindow", "integer", (c) => c.defaultTo(86400000))
    .addColumn("rateLimitMax", "integer", (c) => c.defaultTo(10))
    .addColumn("requestCount", "integer", (c) => c.defaultTo(0))
    .addColumn("remaining", "integer")
    .addColumn("lastRequest", "timestamptz")
    .addColumn("expiresAt", "timestamptz")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addColumn("permissions", "text")
    .addColumn("metadata", "text")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("apikey").execute();
  await db.schema.dropTable("passkey").execute();
  await db.schema.dropTable("invitation").execute();
  await db.schema.dropTable("member").execute();
  await db.schema.dropTable("organization").execute();

  await db.schema.alterTable("session").dropColumn("impersonatedBy").dropColumn("activeOrganizationId").execute();

  await db.schema.alterTable("user").dropColumn("role").dropColumn("banned").dropColumn("banReason").dropColumn("banExpires").execute();
}
