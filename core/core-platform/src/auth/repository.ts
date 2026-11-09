import type { Kysely } from "kysely";
import { ulid } from "ulid";
import { createHash, randomBytes } from "node:crypto";
import type { AuthPlatformDb } from "./schema.js";

function now(): string {
  return new Date().toISOString();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface WorkspacePlatform {
  db: Kysely<AuthPlatformDb>;
}

export function createWorkspacePlatform(db: Kysely<AuthPlatformDb>) {
  return {
    async createOrg(name: string) {
      const row = { id: ulid(), name, slug: slugify(name), created_at: now() };
      await db.insertInto("org").values(row).execute();
      return row;
    },

    async createWorkspace(orgId: string, name: string) {
      const row = { id: ulid(), org_id: orgId, name, slug: slugify(name), created_at: now() };
      await db.insertInto("workspace").values(row).execute();
      return row;
    },

    async createSpace(workspaceId: string, name: string) {
      const row = { id: ulid(), workspace_id: workspaceId, name, slug: slugify(name), created_at: now() };
      await db.insertInto("space").values(row).execute();
      return row;
    },

    async addWorkspaceMember(workspaceId: string, userId: string, role: "owner" | "admin" | "member" = "member") {
      await db
        .insertInto("workspace_member")
        .values({ workspace_id: workspaceId, user_id: userId, role, created_at: now() })
        .execute();
    },

    /** A user always has access to every space in every workspace they're a member of. */
    async listSpaces(workspaceId: string) {
      return db.selectFrom("space").selectAll().where("workspace_id", "=", workspaceId).execute();
    },

    async listWorkspacesForUser(userId: string) {
      return db
        .selectFrom("workspace_member")
        .innerJoin("workspace", "workspace.id", "workspace_member.workspace_id")
        .select(["workspace.id", "workspace.org_id", "workspace.name", "workspace.slug", "workspace_member.role"])
        .where("workspace_member.user_id", "=", userId)
        .execute();
    },

    async isWorkspaceMember(workspaceId: string, userId: string) {
      const row = await db
        .selectFrom("workspace_member")
        .select("role")
        .where("workspace_id", "=", workspaceId)
        .where("user_id", "=", userId)
        .executeTakeFirst();
      return row ?? null;
    },

    /**
     * Issues a workspace-level API key. Returns the raw key exactly once —
     * only the hash is stored. Format: `twodb_<prefix>_<secret>`.
     */
    async issueApiKey(workspaceId: string, createdByUserId: string, name: string, scopes: string[] = []) {
      const prefix = randomBytes(4).toString("hex");
      const secret = randomBytes(24).toString("hex");
      const raw = `twodb_${prefix}_${secret}`;
      const hashed = createHash("sha256").update(raw).digest("hex");

      const row = {
        id: ulid(),
        workspace_id: workspaceId,
        created_by_user_id: createdByUserId,
        name,
        prefix,
        hashed_key: hashed,
        scopes: JSON.stringify(scopes),
        created_at: now(),
        last_used_at: null,
        revoked_at: null,
      };
      await db.insertInto("api_key").values(row).execute();
      return { ...row, rawKey: raw };
    },

    /** Verifies a raw API key, returning its workspace scope or null if invalid/revoked. */
    async verifyApiKey(rawKey: string) {
      const parts = rawKey.split("_");
      if (parts.length !== 3 || parts[0] !== "twodb") return null;
      const prefix = parts[1];
      const hashed = createHash("sha256").update(rawKey).digest("hex");

      const row = await db
        .selectFrom("api_key")
        .selectAll()
        .where("prefix", "=", prefix)
        .where("hashed_key", "=", hashed)
        .executeTakeFirst();

      if (!row || row.revoked_at) return null;

      await db
        .updateTable("api_key")
        .set({ last_used_at: now() })
        .where("id", "=", row.id)
        .execute();

      return { apiKeyId: row.id, workspaceId: row.workspace_id, scopes: JSON.parse(row.scopes) as string[] };
    },

    async revokeApiKey(apiKeyId: string) {
      await db.updateTable("api_key").set({ revoked_at: now() }).where("id", "=", apiKeyId).execute();
    },
  };
}

export type WorkspacePlatformRepo = ReturnType<typeof createWorkspacePlatform>;
