// Org -> Workspace -> Space schema. Lives in TwoDB's control-plane DB (the
// one place identity is centralized). Deliberately portable across the
// Postgres and SQLite Kysely dialects: text ids (ulid, generated in app
// code), text timestamps (ISO-8601), no dialect-specific column types.

import type { Kysely } from "kysely";

export interface OrgTable {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface WorkspaceTable {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface SpaceTable {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface WorkspaceMemberTable {
  workspace_id: string;
  user_id: string;
  role: string; // "owner" | "admin" | "member"
  created_at: string;
}

export interface ApiKeyTable {
  id: string;
  workspace_id: string;
  created_by_user_id: string;
  name: string;
  prefix: string;
  hashed_key: string;
  scopes: string; // JSON-encoded string[]
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface AuthPlatformDb {
  org: OrgTable;
  workspace: WorkspaceTable;
  space: SpaceTable;
  workspace_member: WorkspaceMemberTable;
  api_key: ApiKeyTable;
}

/**
 * Creates the org/workspace/space/membership/api-key tables if they don't
 * exist yet. Safe to call on every boot (idempotent via ifNotExists). This
 * is intentionally separate from better-auth's own `user`/`session`/
 * `account`/`passkey` tables, which better-auth manages itself.
 */
export async function applyAuthPlatformSchema(db: Kysely<AuthPlatformDb>): Promise<void> {
  await db.schema
    .createTable("org")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("slug", "text", (c) => c.notNull().unique())
    .addColumn("created_at", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("workspace")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("org_id", "text", (c) => c.notNull().references("org.id"))
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("slug", "text", (c) => c.notNull())
    .addColumn("created_at", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("space")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull().references("workspace.id"))
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("slug", "text", (c) => c.notNull())
    .addColumn("created_at", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("workspace_member")
    .ifNotExists()
    .addColumn("workspace_id", "text", (c) => c.notNull().references("workspace.id"))
    .addColumn("user_id", "text", (c) => c.notNull())
    .addColumn("role", "text", (c) => c.notNull().defaultTo("member"))
    .addColumn("created_at", "text", (c) => c.notNull())
    .addPrimaryKeyConstraint("workspace_member_pk", ["workspace_id", "user_id"])
    .execute();

  await db.schema
    .createTable("api_key")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull().references("workspace.id"))
    .addColumn("created_by_user_id", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("prefix", "text", (c) => c.notNull())
    .addColumn("hashed_key", "text", (c) => c.notNull())
    .addColumn("scopes", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("created_at", "text", (c) => c.notNull())
    .addColumn("last_used_at", "text")
    .addColumn("revoked_at", "text")
    .execute();
}
