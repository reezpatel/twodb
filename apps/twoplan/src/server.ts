import Fastify from "fastify";
import { createPgDb } from "@twodb/core-data/db";
import { createLocalStorage } from "@twodb/core-data/storage";
import { INTERNAL_MANIFEST_PATH, REGISTRATION_TOKEN_HEADER, handleManifestRequest } from "@twodb/core-platform/manifest";
import { manifest } from "./manifest.js";
import type { TwoPlanConfig } from "./config.js";
import { applySchema, type Db } from "./db/schema.js";
import { registerRoutes } from "./lib/route.js";
import { allRoutes } from "./routes/index.js";

export async function buildServer(config: TwoPlanConfig) {
  const app = Fastify({ logger: true, bodyLimit: 30 * 1024 * 1024 });
  // File uploads arrive as raw bodies (any non-JSON content type); JSON stays default.
  app.removeContentTypeParser("text/plain");
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
  // Tolerate bodiless DELETE/POST that still carry a JSON content-type.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    try {
      done(null, body ? JSON.parse(body as string) : {});
    } catch (e) {
      done(Object.assign(e as Error, { statusCode: 400 }), undefined);
    }
  });

  const db = createPgDb<any>({ connectionString: config.DATABASE_URL, schema: "twoplan" }) as Db;
  await applySchema(db);
  const storage = createLocalStorage({ rootDir: config.TWOPLAN_BLOB_DIR });

  app.get("/healthz", async () => ({ ok: true, app: "twoplan" }));
  app.get(INTERNAL_MANIFEST_PATH, async (req, reply) => {
    const res = handleManifestRequest(manifest, { registrationToken: config.TWODB_PROVISION_TOKEN, httpUrl: config.HTTP_URL }, req.headers[REGISTRATION_TOKEN_HEADER]);
    return reply.code(res.status).send(res.body);
  });

  registerRoutes(app, { db, storage }, allRoutes);
  app.addHook("onClose", async () => {
    await db.destroy();
  });
  return app;
}
