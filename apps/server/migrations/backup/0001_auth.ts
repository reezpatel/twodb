import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("user")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("email", "text", (c) => c.notNull().unique())
    .addColumn("emailVerified", "boolean", (c) => c.notNull())
    .addColumn("image", "text")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("session")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("expiresAt", "timestamptz", (c) => c.notNull())
    .addColumn("token", "text", (c) => c.notNull().unique())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addColumn("ipAddress", "text")
    .addColumn("userAgent", "text")
    .addColumn("userId", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .execute();

  await db.schema
    .createTable("account")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("accountId", "text", (c) => c.notNull())
    .addColumn("providerId", "text", (c) => c.notNull())
    .addColumn("userId", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .addColumn("accessToken", "text")
    .addColumn("refreshToken", "text")
    .addColumn("idToken", "text")
    .addColumn("accessTokenExpiresAt", "timestamptz")
    .addColumn("refreshTokenExpiresAt", "timestamptz")
    .addColumn("scope", "text")
    .addColumn("password", "text")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("verification")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("identifier", "text", (c) => c.notNull())
    .addColumn("value", "text", (c) => c.notNull())
    .addColumn("expiresAt", "timestamptz", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz")
    .addColumn("updatedAt", "timestamptz")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("verification").execute();
  await db.schema.dropTable("account").execute();
  await db.schema.dropTable("session").execute();
  await db.schema.dropTable("user").execute();
}
