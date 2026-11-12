import Fastify from "fastify";
import { createPgDb } from "@twodb/core-data/db";
import { INTERNAL_MANIFEST_PATH, REGISTRATION_TOKEN_HEADER, handleManifestRequest } from "@twodb/core-platform/manifest";
import type { GardenConfig } from "./config.js";
import { applySchema, type GardenDb } from "./db/schema.js";
import { manifest } from "./manifest.js";
import { sendError } from "./http.js";
import { registerRecordRoutes } from "./routes/records.js";
import { registerDatabaseRoutes } from "./routes/databases.js";
import { registerAssetRoutes } from "./routes/assets.js";

export async function buildServer(config: GardenConfig) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" }, bodyLimit: 8 * 1024 * 1024 });
  // Tolerate an empty body under content-type: application/json (browsers send that for body-less POSTs).
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    if (!body) return done(null, {});
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      (err as { statusCode?: number }).statusCode = 400;
      done(err as Error, undefined);
    }
  });

  const db = createPgDb<GardenDb>({ connectionString: config.DATABASE_URL, schema: "garden" });
  await applySchema(db);

  app.setErrorHandler((err, _req, reply) => sendError(err, reply, app.log));

  app.get("/healthz", async () => ({ ok: true, app: manifest.slug }));
  app.get(INTERNAL_MANIFEST_PATH, async (req, reply) => {
    const res = handleManifestRequest(
      manifest,
      { registrationToken: config.TWODB_PROVISION_TOKEN, httpUrl: config.HTTP_URL },
      req.headers[REGISTRATION_TOKEN_HEADER] as string | undefined,
    );
    return reply.code(res.status).send(res.body);
  });

  registerRecordRoutes(app, db);
  registerDatabaseRoutes(app, db);
  registerAssetRoutes(app, db, config.MAX_ASSET_BYTES);

  app.addHook("onClose", async () => {
    await db.destroy();
  });
  return { app, db };
}
