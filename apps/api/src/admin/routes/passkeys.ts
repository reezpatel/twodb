import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { newId, parseJsonArray } from "@twodb/shared-backend";
import type { App } from "../lib/types";
import { registrationOptions, verifyRegistration } from "../lib/webauthn";
import { createSession, hasSession, requireAdmin } from "../lib/session";

async function passkeyCount(app: App): Promise<number> {
  const row = await app.db
    .selectFrom("admin_passkeys")
    .select((eb) => eb.fn.countAll().as("count"))
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

// Registration is open while zero passkeys exist (bootstrap); afterwards it
// requires an admin session.
async function registrationGate(app: App, request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if ((await passkeyCount(app)) > 0 && !(await hasSession(app, request))) {
    reply.code(401).send({ error: "admin_auth_required" });
    return false;
  }
  return true;
}

const passkeyRoutes: FastifyPluginAsync = async (app) => {
  app.post("/passkeys/register/options", async (request, reply) => {
    if (!(await registrationGate(app, request, reply))) return reply;

    const existing = await app.db.selectFrom("admin_passkeys").select(["credential_id", "transports"]).execute();

    return registrationOptions(
      app,
      existing.map((row) => ({
        id: row.credential_id,
        transports: parseJsonArray(row.transports),
      })),
    );
  });

  app.post("/passkeys/register/verify", async (request, reply) => {
    if (!(await registrationGate(app, request, reply))) return reply;

    const { response, name } = request.body as {
      response?: RegistrationResponseJSON;
      name?: string;
    };
    if (!response) {
      return reply.code(400).send({ error: "missing_response" });
    }

    const wasBootstrap = (await passkeyCount(app)) === 0;

    let verification;
    try {
      verification = await verifyRegistration(app, response);
    } catch (err) {
      request.log.warn({ err }, "admin passkey registration failed");
      return reply.code(400).send({ error: "verification_failed" });
    }
    if (!verification.verified || !verification.registrationInfo) {
      return reply.code(400).send({ error: "verification_failed" });
    }

    const { credential } = verification.registrationInfo;
    await app.db
      .insertInto("admin_passkeys")
      .values({
        id: newId("apk"),
        credential_id: credential.id,
        public_key: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ? JSON.stringify(credential.transports) : null,
        name: name?.trim() || "Passkey",
      })
      .execute();

    // Bootstrap: the first passkey doubles as the login.
    if (wasBootstrap) {
      await createSession(app, reply);
    }
    return { ok: true };
  });

  app.get("/passkeys", { preHandler: requireAdmin }, async () => {
    return app.db.selectFrom("admin_passkeys").select(["id", "name", "transports", "created_at", "last_used_at"]).orderBy("created_at").execute();
  });

  app.delete<{ Params: { id: string } }>("/passkeys/:id", { preHandler: requireAdmin }, async (request, reply) => {
    if ((await passkeyCount(app)) <= 1) {
      return reply.code(409).send({ error: "last_passkey", message: "One passkey must exist" });
    }
    await app.db.deleteFrom("admin_passkeys").where("id", "=", request.params.id).execute();
    return { ok: true };
  });
};

export default passkeyRoutes;
