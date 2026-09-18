import type { FastifyPluginAsync } from "fastify";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import type { App } from "../lib/types";
import { authenticationOptions, verifyAuthentication } from "../lib/webauthn";
import { createSession, destroySession, hasSession, requireAdmin } from "../lib/session";

async function passkeyCount(app: App): Promise<number> {
  const row = await app.db
    .selectFrom("admin_passkeys")
    .select((eb) => eb.fn.countAll().as("count"))
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

const authRoutes: FastifyPluginAsync = async (app) => {
  app.get("/session", async (request) => {
    return {
      authenticated: await hasSession(app, request),
      bootstrapRequired: (await passkeyCount(app)) === 0,
    };
  });

  app.post("/login/options", async () => {
    return authenticationOptions(app);
  });

  app.post("/login/verify", async (request, reply) => {
    const { response } = request.body as {
      response?: AuthenticationResponseJSON;
    };
    if (!response) {
      return reply.code(400).send({ error: "missing_response" });
    }

    const passkey = await app.db.selectFrom("admin_passkeys").selectAll().where("credential_id", "=", response.id).executeTakeFirst();
    if (!passkey) {
      return reply.code(401).send({ error: "unknown_credential" });
    }

    let verification;
    try {
      verification = await verifyAuthentication(app, response, passkey);
    } catch (err) {
      request.log.warn({ err }, "admin login verification failed");
      return reply.code(401).send({ error: "verification_failed" });
    }
    if (!verification.verified) {
      return reply.code(401).send({ error: "verification_failed" });
    }

    await app.db
      .updateTable("admin_passkeys")
      .set({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date(),
      })
      .where("id", "=", passkey.id)
      .execute();

    await createSession(app, reply);
    return { ok: true };
  });

  app.post("/logout", { preHandler: requireAdmin }, async (request, reply) => {
    await destroySession(app, request);
    reply.clearCookie("twodb_admin", { path: "/" });
    return { ok: true };
  });
};

export default authRoutes;
