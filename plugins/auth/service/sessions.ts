import { createHash, randomBytes } from "node:crypto";
import type { Kysely } from "kysely";
import type { TwodbDatabase } from "@twodb/shared-backend";

export const USER_COOKIE = "twodb_user_session";

export type SessionUser = { id: string; email: string };

type AuthDb = {
  auth_users: { id: string; email: string };
  auth_user_sessions: {
    token_hash: string;
    user_id: string;
    expires_at: Date;
  };
};

const authDb = (db: Kysely<TwodbDatabase>) => db as unknown as Kysely<AuthDb>;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createUserSession(db: Kysely<TwodbDatabase>, userId: string, ttlMs: number): Promise<{ token: string; maxAge: number }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMs);
  await authDb(db)
    .insertInto("auth_user_sessions")
    .values({ token_hash: hashToken(token), user_id: userId, expires_at: expiresAt })
    .execute();
  return { token, maxAge: Math.floor(ttlMs / 1000) };
}

export async function sessionUser(db: Kysely<TwodbDatabase>, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const row = await authDb(db)
    .selectFrom("auth_user_sessions")
    .innerJoin("auth_users", "auth_users.id", "auth_user_sessions.user_id")
    .select(["auth_users.id as id", "auth_users.email as email", "auth_user_sessions.expires_at as expires_at"])
    .where("auth_user_sessions.token_hash", "=", tokenHash)
    .executeTakeFirst();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await authDb(db).deleteFrom("auth_user_sessions").where("token_hash", "=", tokenHash).execute();
    return null;
  }
  return { id: row.id, email: row.email };
}

export async function destroySession(db: Kysely<TwodbDatabase>, token: string | undefined): Promise<void> {
  if (!token) return;
  await authDb(db).deleteFrom("auth_user_sessions").where("token_hash", "=", hashToken(token)).execute();
}
