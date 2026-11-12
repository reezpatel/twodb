import Fastify from "fastify";
import { createPgDb } from "@twodb/core-data/db";

import { manifest } from "./manifest.js";
import type { TwoThingConfig } from "./config.js";
import { applySchema, type TwoThingDb } from "./db/schema.js";
import { setDevWorkspace } from "./gateway-context.js";
import { registerItemRoutes } from "./routes/items.js";
import { registerLocationRoutes } from "./routes/locations.js";
import { registerCodeRoutes } from "./routes/codes.js";
import { registerMiscRoutes } from "./routes/misc.js";

export async function buildServer(config: TwoThingConfig) {
  const app = Fastify({ logger: { level: config.NODE_ENV === "production" ? "info" : "warn" }, bodyLimit: 10 * 1024 * 1024 });
  // Images arrive as raw bytes; JSON keeps Fastify's default parser.
  app.addContentTypeParser(/^image\//, { parseAs: "buffer" }, (_req, body, done) => done(null, body));
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (_req, body, done) => done(null, body));

  const db = createPgDb<TwoThingDb>({ connectionString: config.DATABASE_URL, schema: "twothing" });
  await applySchema(db);

  if (config.TWOTHING_DEV_WORKSPACE) {
    if (config.NODE_ENV === "production") throw new Error("TWOTHING_DEV_WORKSPACE must not be set in production");
    setDevWorkspace(config.TWOTHING_DEV_WORKSPACE);
    console.warn(`[twothing] DEV identity fallback enabled → workspace "${config.TWOTHING_DEV_WORKSPACE}"`);
  }

  app.get("/healthz", async () => ({ ok: true, app: manifest.slug }));

  const ctx = { db };
  registerItemRoutes(app, ctx);
  registerLocationRoutes(app, ctx);
  registerCodeRoutes(app, ctx);
  registerMiscRoutes(app, ctx);

  return { app, db };
}
