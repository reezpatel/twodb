import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { App } from "./types";

export const ADMIN_COOKIE = "twodb_admin";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(app: App, reply: FastifyReply): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const ttlMs = app.config.TWODB_ADMIN_SESSION_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs);

  await app.db
    .insertInto("admin_sessions")
    .values({ token_hash: hashToken(token), expires_at: expiresAt })
    .execute();

  reply.setCookie(ADMIN_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: Math.floor(ttlMs / 1000),
  });
}

export async function destroySession(app: App, request: FastifyRequest): Promise<void> {
  const token = request.cookies[ADMIN_COOKIE];
  if (token) {
    await app.db.deleteFrom("admin_sessions").where("token_hash", "=", hashToken(token)).execute();
  }
}

export async function hasSession(app: App, request: FastifyRequest): Promise<boolean> {
  const token = request.cookies[ADMIN_COOKIE];
  if (!token) return false;

  const row = await app.db.selectFrom("admin_sessions").selectAll().where("token_hash", "=", hashToken(token)).executeTakeFirst();

  if (!row) return false;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await destroySession(app, request);
    return false;
  }
  return true;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!(await hasSession(request.server as App, request))) {
    reply.code(401);
    return reply.send({ error: "admin_auth_required" });
  }
}
