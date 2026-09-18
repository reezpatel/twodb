import { createHash, randomBytes } from "node:crypto";
import type { Kysely } from "kysely";
import type { AuthDb } from "./db";

export const USER_COOKIE = "twodb_user_session";

export type SessionUser = { id: string; email: string };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createUserSession(db: Kysely<AuthDb>, userId: string, ttlMs: number): Promise<{ token: string; maxAge: number }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMs);
  await db
    .insertInto("user_sessions")
    .values({ token_hash: hashToken(token), user_id: userId, expires_at: expiresAt })
    .execute();
  return { token, maxAge: Math.floor(ttlMs / 1000) };
}

export async function sessionUser(db: Kysely<AuthDb>, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const row = await db
    .selectFrom("user_sessions")
    .innerJoin("users", "users.id", "user_sessions.user_id")
    .select(["users.id as id", "users.email as email", "user_sessions.expires_at as expires_at"])
    .where("user_sessions.token_hash", "=", tokenHash)
    .executeTakeFirst();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await db.deleteFrom("user_sessions").where("token_hash", "=", tokenHash).execute();
    return null;
  }
  return { id: row.id, email: row.email };
}

export async function destroySession(db: Kysely<AuthDb>, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.deleteFrom("user_sessions").where("token_hash", "=", hashToken(token)).execute();
}
