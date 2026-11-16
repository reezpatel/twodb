import Fastify from "fastify";
import * as path from "node:path";
import { webappRewriteUrl, registerWebapp, webappDist } from "@twodb/twodb-core/webapp";
import { withKeyPrefix } from "@twodb/twodb-core";
import { createPgDb } from "@twodb/core-data/db";
import { createLocalStorage, type StorageAdapter } from "@twodb/core-data/storage";
import type { TwoPagerConfig } from "./config.js";
import { applySchema, type Db } from "./db/schema.js";
import { registerRoutes } from "./lib/route.js";
import { allRoutes } from "./routes/index.js";
import { BlobCache } from "./engine/cache.js";
import { Blobs } from "./lib/blobs.js";
import { SiteResolver } from "./engine/resolver.js";
import { SITE_PREFIX, createAdminHostCheck, registerSiteServing, requestHost } from "./engine/serve.js";

/**
 * Two surfaces on one port:
 *   /api/*, /healthz, /_svc/*   admin API (identity from the gateway)
 *   everything else             by Host: admin hosts -> the bundled admin SPA; any other host -> the site published there
 * The gateway sends unknown hosts here (CATCH_ALL_SERVICE=twopager) and `<slug>.<ROOT_DOMAIN>` for the admin host.
 */
export async function buildServer(config: TwoPagerConfig, deps: { storage?: StorageAdapter | null } = {}) {
  const isAdminHost = createAdminHostCheck(config.ADMIN_HOSTS);
  const zipBodyLimit = Math.ceil(config.MAX_ZIP_MB * 1048576 * 1.4) + 1048576; // base64 JSON is ~1.37x

  const app = Fastify({
    logger: true,
    bodyLimit: zipBodyLimit,
    rewriteUrl: (req) => {
      const rewritten = webappRewriteUrl(req);
      if (!rewritten.startsWith("/__web")) return rewritten; // /api, /healthz, /_svc
      if (isAdminHost(requestHost(req as any))) return rewritten;
      const url = req.url ?? "/";
      return SITE_PREFIX + (url.startsWith("/") ? url : `/${url}`);
    },
  });

  // Raw zip uploads; JSON stays tolerant of bodiless requests that still carry a JSON content-type.
  app.addContentTypeParser(["application/zip", "application/x-zip-compressed", "application/octet-stream"], { parseAs: "buffer" }, (_req, body, done) => done(null, body));
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    try {
      done(null, body ? JSON.parse(body as string) : {});
    } catch (e) {
      done(Object.assign(e as Error, { statusCode: 400 }), undefined);
    }
  });

  const db = createPgDb<any>({ connectionString: config.DATABASE_URL, schema: "twopager" }) as Db;
  await applySchema(db);

  const storage = deps.storage ?? withKeyPrefix(createLocalStorage({ rootDir: path.resolve(config.LOCAL_STORAGE_DIR) }), "twopager/");
  const cache = new BlobCache(path.resolve(config.CACHE_DIR), config.CACHE_MAX_MB * 1048576);
  const blobs = new Blobs(storage, cache, db);
  const resolver = new SiteResolver(db, config.SITES_DOMAIN?.replace(/^\.+/, "").toLowerCase() || null);

  app.get("/healthz", async () => ({ ok: true, app: "twopager", cache: cache.stats }));
  registerRoutes(app, { db, blobs, resolver, config }, allRoutes);
  registerSiteServing(app, { resolver, blobs });
  app.addHook("onClose", async () => {
    await db.destroy();
  });
  await registerWebapp(app, { distDir: webappDist(import.meta.dirname) });
  return app;
}
