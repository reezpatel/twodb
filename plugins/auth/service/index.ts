import type { RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/server";
import type {} from "@fastify/cookie";
import { newId, parseJsonArray } from "@twodb/shared-backend";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Kysely, Selectable } from "kysely";
import { authMigrations, type AuthConfigTable, type AuthDb } from "./db";
import { createUserSession, destroySession, sessionUser, USER_COOKIE } from "./sessions";
import { authenticationOptions, hostConfig, registrationOptions, verifyAuthentication, verifyRegistration } from "./webauthn";

const db = (ctx: TwodbContext) => ctx.db as unknown as Kysely<AuthDb>;
type ConfigRow = Selectable<AuthConfigTable>;

async function readConfig(ctx: TwodbContext): Promise<ConfigRow> {
  return db(ctx).selectFrom("auth_config").selectAll().where("id", "=", 1).executeTakeFirstOrThrow();
}

const publicOptions = (cfg: ConfigRow) => ({
  passkeys: cfg.passkeys_enabled,
  googleSso: cfg.google_sso_enabled,
  magicLink: cfg.magic_link_enabled,
});

const adminConfigShape = (cfg: ConfigRow) => ({
  passkeys: { enabled: cfg.passkeys_enabled },
  googleSso: {
    enabled: cfg.google_sso_enabled,
    clientId: cfg.google_client_id,
    hasSecret: Boolean(cfg.google_client_secret),
  },
  magicLink: { enabled: cfg.magic_link_enabled },
});

const normalizeEmail = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

// --- Admin: configure the auth process. The host guards every /admin/*
// route with the admin passkey session. ---

function registerAdminRoutes(ctx: TwodbContext, app: FastifyInstance) {
  app.get("/admin/config", async () => adminConfigShape(await readConfig(ctx)));

  app.put("/admin/config", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body ?? {}) as {
      passkeys?: { enabled?: boolean };
      googleSso?: { enabled?: boolean; clientId?: string; clientSecret?: string };
      magicLink?: { enabled?: boolean };
    };
    const current = await readConfig(ctx);

    const passkeys = body.passkeys?.enabled ?? current.passkeys_enabled;
    const googleEnabled = body.googleSso?.enabled ?? current.google_sso_enabled;
    const magicLink = body.magicLink?.enabled ?? current.magic_link_enabled;

    if (!passkeys && !googleEnabled && !magicLink) {
      return reply.code(400).send({ error: "no_auth_method", message: "At least one auth method must stay enabled" });
    }
    if (googleEnabled && !body.googleSso?.clientId && !current.google_client_id) {
      return reply.code(400).send({ error: "google_missing_client_id", message: "Google SSO needs a client id before it can be enabled" });
    }

    const updated = await db(ctx)
      .updateTable("auth_config")
      .set({
        passkeys_enabled: passkeys,
        google_sso_enabled: googleEnabled,
        magic_link_enabled: magicLink,
        ...(body.googleSso?.clientId !== undefined ? { google_client_id: body.googleSso.clientId || null } : {}),
        // omitted secret keeps the stored one (the admin UI never echoes it back)
        ...(body.googleSso?.clientSecret ? { google_client_secret: body.googleSso.clientSecret } : {}),
        updated_at: new Date(),
      })
      .where("id", "=", 1)
      .returningAll()
      .executeTakeFirstOrThrow();

    return adminConfigShape(updated);
  });
}

// --- User auth: passkeys for normal users, keyed by email in this
// plugin's own schema (separate from the host's admin passkeys). ---

function registerUserRoutes(ctx: TwodbContext, app: FastifyInstance) {
  app.get("/options", async () => publicOptions(await readConfig(ctx)));

  app.post("/auth/passkeys/register/options", async (request: FastifyRequest, reply: FastifyReply) => {
    const cfg = await readConfig(ctx);
    if (!cfg.passkeys_enabled) {
      return reply.code(400).send({ error: "passkeys_disabled" });
    }

    const body = (request.body ?? {}) as { email?: unknown; name?: unknown };
    const email = normalizeEmail(body.email);
    if (!email) {
      return reply.code(400).send({ error: "invalid_email" });
    }

    const existing = await db(ctx).selectFrom("users").selectAll().where("email", "=", email).executeTakeFirst();
    const user = { id: existing?.id ?? newId("usr"), email };

    const credentials = await db(ctx)
      .selectFrom("user_passkeys")
      .select(["credential_id", "transports"])
      .where("user_id", "=", user.id)
      .execute();

    return registrationOptions(
      request,
      user,
      typeof body.name === "string" ? body.name : undefined,
      credentials.map((row) => ({ id: row.credential_id, transports: parseJsonArray(row.transports) ?? undefined })),
    );
  });

  app.post("/auth/passkeys/register/verify", async (request: FastifyRequest, reply: FastifyReply) => {
    const cfg = await readConfig(ctx);
    if (!cfg.passkeys_enabled) {
      return reply.code(400).send({ error: "passkeys_disabled" });
    }

    const body = (request.body ?? {}) as { email?: unknown; name?: unknown; credential?: RegistrationResponseJSON };
    const email = normalizeEmail(body.email);
    if (!email || !body.credential) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    let verification;
    try {
      verification = await verifyRegistration(request, body.credential);
    } catch {
      return reply.code(400).send({ error: "verification_failed" });
    }
    if (!verification.verified || !verification.registrationInfo) {
      return reply.code(400).send({ error: "verification_failed" });
    }

    const { credential } = verification.registrationInfo;
    const user =
      (await db(ctx).selectFrom("users").selectAll().where("email", "=", email).executeTakeFirst()) ??
      (await db(ctx)
        .insertInto("users")
        .values({ id: newId("usr"), email })
        .returningAll()
        .executeTakeFirstOrThrow());

    await db(ctx)
      .insertInto("user_passkeys")
      .values({
        id: newId("upk"),
        user_id: user.id,
        credential_id: credential.id,
        public_key: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ? JSON.stringify(credential.transports) : null,
        name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Passkey",
        last_used_at: null,
      })
      .execute();

    return { ok: true, user: { id: user.id, email: user.email } };
  });

  app.post("/auth/passkeys/login/options", async (request: FastifyRequest, reply: FastifyReply) => {
    const cfg = await readConfig(ctx);
    if (!cfg.passkeys_enabled) {
      return reply.code(400).send({ error: "passkeys_disabled" });
    }

    // Passkeys are discoverable: email narrows the allowed credentials when
    // given, but is not required for the ceremony itself.
    const body = (request.body ?? {}) as { email?: unknown };
    const email = normalizeEmail(body.email);

    let allow: { id: string; transports?: string[] }[] = [];
    if (email) {
      const rows = await db(ctx)
        .selectFrom("user_passkeys")
        .innerJoin("users", "users.id", "user_passkeys.user_id")
        .select(["credential_id", "transports"])
        .where("users.email", "=", email)
        .execute();
      allow = rows.map((row) => ({ id: row.credential_id, transports: parseJsonArray(row.transports) ?? undefined }));
    }
    return authenticationOptions(request, allow);
  });

  app.post("/auth/passkeys/login/verify", async (request: FastifyRequest, reply: FastifyReply) => {
    const cfg = await readConfig(ctx);
    if (!cfg.passkeys_enabled) {
      return reply.code(400).send({ error: "passkeys_disabled" });
    }

    const body = (request.body ?? {}) as { credential?: AuthenticationResponseJSON };
    if (!body.credential) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const passkey = await db(ctx)
      .selectFrom("user_passkeys")
      .innerJoin("users", "users.id", "user_passkeys.user_id")
      .selectAll("user_passkeys")
      .select(["users.id as user_id", "users.email as user_email"])
      .where("credential_id", "=", body.credential.id)
      .executeTakeFirst();
    if (!passkey) {
      return reply.code(401).send({ error: "unknown_credential" });
    }

    let verification;
    try {
      verification = await verifyAuthentication(request, body.credential, passkey);
    } catch {
      return reply.code(400).send({ error: "verification_failed" });
    }
    if (!verification.verified) {
      return reply.code(400).send({ error: "verification_failed" });
    }

    await db(ctx)
      .updateTable("user_passkeys")
      .set({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date(),
      })
      .where("credential_id", "=", passkey.credential_id)
      .execute();

    const session = await createUserSession(db(ctx), passkey.user_id, hostConfig(request).TWODB_AUTH_SESSION_TTL_MS);
    reply.setCookie(USER_COOKIE, session.token, { path: "/", httpOnly: true, sameSite: "lax", maxAge: session.maxAge });
    return { user: { id: passkey.user_id, email: passkey.user_email } };
  });

  app.get("/auth/session", async (request: FastifyRequest) => {
    const user = await sessionUser(db(ctx), request.cookies[USER_COOKIE]);
    return { user: user ? { id: user.id, email: user.email } : null };
  });

  app.post("/auth/logout", async (request: FastifyRequest, reply: FastifyReply) => {
    await destroySession(db(ctx), request.cookies[USER_COOKIE]);
    reply.clearCookie(USER_COOKIE, { path: "/" });
    return { ok: true };
  });
}

const AuthServicePlugin = {
  // app is the scoped fastify instance (prefix /api/v1/io.twodb.auth) the
  // host hands us — routes register on it with relative paths.
  init: async (ctx: TwodbContext, app: FastifyInstance) => {
    registerAdminRoutes(ctx, app);
    registerUserRoutes(ctx, app);
  },
  migrations: authMigrations,
} satisfies ServicePlugin;

export default AuthServicePlugin;
