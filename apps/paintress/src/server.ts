import Fastify from "fastify";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import { createPgDb } from "@twodb/core-data/db";
import { INTERNAL_MANIFEST_PATH, REGISTRATION_TOKEN_HEADER, handleManifestRequest } from "@twodb/core-platform/manifest";
import type { PaintressConfig } from "./config.js";
import { applySchema, type PaintressDb } from "./db/schema.js";
import { manifest } from "./manifest.js";
import { createStore } from "./store.js";
import { createHub } from "./hub.js";
import { createBlobStorage } from "./storage.js";
import { sendError } from "./http.js";
import { registerBoardRoutes } from "./routes/boards.js";
import { registerBuildRoutes } from "./routes/build.js";
import { registerMiscRoutes } from "./routes/misc.js";
import { registerBoardSocket } from "./ws.js";

export async function buildServer(config: PaintressConfig) {
  const app = Fastify({ logger: true, bodyLimit: 20 * 1024 * 1024 });
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
  await app.register(websocket, { options: { maxPayload: 8 * 1024 * 1024 } });
  await app.register(multipart);

  const db = createPgDb<PaintressDb>({ connectionString: config.DATABASE_URL, schema: "paintress" });
  await applySchema(db);
  const store = createStore(db);
  const blobs = await createBlobStorage(config);
  const hub = createHub(store, config.DATABASE_URL, "paintress", app.log);
  await hub.start();

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

  registerBoardRoutes(app, store);
  registerBuildRoutes(app, store);
  registerMiscRoutes(app, store, blobs);
  registerBoardSocket(app, store, hub);

  app.addHook("onClose", async () => {
    await hub.stop();
    await db.destroy();
  });
  return { app, store, hub, db };
}
