import type {} from "@fastify/cookie";
import { newId, parseJsonArray } from "@twodb/shared-backend";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Kysely } from "kysely";
import type { TwodbDatabase } from "@twodb/shared-backend";
import type {
  AuthMethodOptions,
  LogoutResponse,
  AuthSessionResponse,
  LoginPasskeyOptionsRequest,
  LoginPasskeyVerifyRequest,
  LoginPasskeyVerifyResponse,
  RegisterPasskeyOptionsRequest,
  RegisterPasskeyVerifyRequest,
  RegisterPasskeyVerifyResponse,
} from "../shared/api";
import { readAuthConfig } from "./config";
import { authMigrations } from "./db";
import { createUserSession, destroySession, sessionUser, USER_COOKIE } from "./sessions";
import type {} from "../shared/fn";
import { authenticationOptions, hostConfig, registrationOptions, verifyAuthentication, verifyRegistration } from "./webauthn";

const db = (ctx: TwodbContext) => ctx.db as unknown as Kysely<TwodbDatabase>;

const publicOptions = (cfg: Awaited<ReturnType<typeof readAuthConfig>>): AuthMethodOptions => ({
  passkeys: cfg.passkeys.enabled,
  googleSso: cfg.googleSso.enabled,
  magicLink: cfg.magicLink.enabled,
});

const normalizeEmail = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

function registerUserRoutes(ctx: TwodbContext, app: FastifyInstance) {
  app.get("/options", async () => publicOptions(await readAuthConfig(ctx)));

  app.post("/auth/passkeys/register/options", async (request: FastifyRequest, reply: FastifyReply) => {
    const cfg = await readAuthConfig(ctx);
    if (!cfg.passkeys.enabled) {
      return reply.code(400).send({ error: "passkeys_disabled" });
    }

    const body = (request.body ?? {}) as Partial<RegisterPasskeyOptionsRequest>;
    const email = normalizeEmail(body.email);
    if (!email) {
      return reply.code(400).send({ error: "invalid_email" });
    }

    const existing = await db(ctx).selectFrom("auth_users").selectAll().where("email", "=", email).executeTakeFirst();
    const user = { id: existing?.id ?? newId("usr"), email };

    const credentials = await db(ctx).selectFrom("auth_user_passkeys").select(["credential_id", "transports"]).where("user_id", "=", user.id).execute();

    return registrationOptions(
      request,
      user,
      typeof body.name === "string" ? body.name : undefined,
      credentials.map((row) => ({ id: row.credential_id, transports: parseJsonArray(row.transports) ?? undefined })),
    );
  });

  app.post("/auth/passkeys/register/verify", async (request: FastifyRequest, reply: FastifyReply) => {
    const cfg = await readAuthConfig(ctx);
    if (!cfg.passkeys.enabled) {
      return reply.code(400).send({ error: "passkeys_disabled" });
    }

    const body = (request.body ?? {}) as Partial<RegisterPasskeyVerifyRequest>;
    const email = normalizeEmail(body.email);
    if (!email || !body.credential) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    let verification;
    try {
      verification = await verifyRegistration(request, body.credential);
    } catch (err) {
      request.log.warn({ err }, "passkey registration verification failed");
      return reply.code(400).send({ error: "verification_failed" });
    }
    if (!verification.verified || !verification.registrationInfo) {
      return reply.code(400).send({ error: "verification_failed" });
    }

    const { credential } = verification.registrationInfo;
    const user =
      (await db(ctx).selectFrom("auth_users").selectAll().where("email", "=", email).executeTakeFirst()) ??
      (await db(ctx)
        .insertInto("auth_users")
        .values({ id: newId("usr"), email })
        .returningAll()
        .executeTakeFirstOrThrow());

    await db(ctx)
      .insertInto("auth_user_passkeys")
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

    return { ok: true, user: { id: user.id, email: user.email } } satisfies RegisterPasskeyVerifyResponse;
  });

  app.post("/auth/passkeys/login/options", async (request: FastifyRequest, reply: FastifyReply) => {
    const cfg = await readAuthConfig(ctx);
    if (!cfg.passkeys.enabled) {
      return reply.code(400).send({ error: "passkeys_disabled" });
    }

    // email is optional: passkeys are discoverable
    const body = (request.body ?? {}) as LoginPasskeyOptionsRequest;
    const email = normalizeEmail(body.email);

    let allow: { id: string; transports?: string[] }[] = [];
    if (email) {
      const rows = await db(ctx)
        .selectFrom("auth_user_passkeys")
        .innerJoin("auth_users", "auth_users.id", "auth_user_passkeys.user_id")
        .select(["credential_id", "transports"])
        .where("auth_users.email", "=", email)
        .execute();
      allow = rows.map((row) => ({ id: row.credential_id, transports: parseJsonArray(row.transports) ?? undefined }));
    }
    return authenticationOptions(request, allow);
  });

  app.post("/auth/passkeys/login/verify", async (request: FastifyRequest, reply: FastifyReply) => {
    const cfg = await readAuthConfig(ctx);
    if (!cfg.passkeys.enabled) {
      return reply.code(400).send({ error: "passkeys_disabled" });
    }

    const body = (request.body ?? {}) as Partial<LoginPasskeyVerifyRequest>;
    if (!body.credential) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const passkey = await db(ctx)
      .selectFrom("auth_user_passkeys")
      .innerJoin("auth_users", "auth_users.id", "auth_user_passkeys.user_id")
      .selectAll("auth_user_passkeys")
      .select(["auth_users.id as user_id", "auth_users.email as user_email"])
      .where("credential_id", "=", body.credential.id)
      .executeTakeFirst();
    if (!passkey) {
      return reply.code(401).send({ error: "unknown_credential" });
    }

    let verification;
    try {
      verification = await verifyAuthentication(request, body.credential, passkey);
    } catch (err) {
      request.log.warn({ err }, "passkey login verification failed");
      return reply.code(400).send({ error: "verification_failed" });
    }
    if (!verification.verified) {
      return reply.code(400).send({ error: "verification_failed" });
    }

    await db(ctx)
      .updateTable("auth_user_passkeys")
      .set({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date(),
      })
      .where("credential_id", "=", passkey.credential_id)
      .execute();

    const session = await createUserSession(db(ctx), passkey.user_id, hostConfig(request).TWODB_ADMIN_SESSION_TTL_MS);
    reply.setCookie(USER_COOKIE, session.token, { path: "/", httpOnly: true, sameSite: "lax", maxAge: session.maxAge });
    return { user: { id: passkey.user_id, email: passkey.user_email } } satisfies LoginPasskeyVerifyResponse;
  });

  app.get("/auth/session", async (request: FastifyRequest) => {
    const user = await sessionUser(db(ctx), request.cookies[USER_COOKIE]);
    return { user: user ? { id: user.id, email: user.email } : null } satisfies AuthSessionResponse;
  });

  app.post("/auth/logout", async (request: FastifyRequest, reply: FastifyReply) => {
    await destroySession(db(ctx), request.cookies[USER_COOKIE]);
    reply.clearCookie(USER_COOKIE, { path: "/" });
    return { ok: true } satisfies LogoutResponse;
  });
}

const AuthServicePlugin = {
  setup: async (ctx: TwodbContext, app: FastifyInstance) => {
    app.decorateRequest("userId", null);
    app.addHook("onRequest", async (request) => {
      const user = await sessionUser(db(ctx), request.cookies[USER_COOKIE]);
      request.userId = user?.id ?? null;
    });
  },
  init: async (ctx: TwodbContext, app: FastifyInstance) => {
    registerUserRoutes(ctx, app);
  },
  migrations: authMigrations,
} satisfies ServicePlugin;

export default AuthServicePlugin;
