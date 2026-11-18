/**
 * Webapp + API serving contract shared by every TwoDB app backend.
 *
 * An app is ONE process that serves two surfaces on the same origin:
 *
 *   /api/*        the JSON/WS API  (handlers stay registered at their short paths, e.g. /boards;
 *                 `webappRewriteUrl` strips the /api prefix before Fastify routes the request)
 *   everything else  the bundled React SPA (apps/<slug>/webapp/dist), with SPA fallback to index.html
 *
 * Two paths deliberately stay un-prefixed because they are infrastructure, not product surface:
 *   /healthz   liveness probe
 *   /_svc/*    app-to-app (service token) endpoints
 *
 * Usage in an app's buildServer():
 *
 *   const app = Fastify({ logger: true, rewriteUrl: webappRewriteUrl });
 *   ... register API routes at their short paths ...
 *   await registerWebapp(app, { distDir: path.join(import.meta.dirname, "../webapp/dist") });
 *
 * The gateway reaches an app at `<app base>/api/...` (manifest basePath is `/apps/<slug>/api`) and
 * serves the SPA anonymously from `<app base>/` (see apps/twodb/src/gateway/server.ts).
 */
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";
import fastifyStatic from "@fastify/static";

export const API_PREFIX = "/api";
/**
 * Shared request-body ceiling for every app's Fastify instance. The gateway
 * already buffers bodies before proxying (its own limit is far higher), so a
 * generous per-app cap keeps large payloads — chat contexts with images,
 * audio, file/zip uploads — from tripping Fastify's tiny 1 MiB default while
 * still bounding memory. 100 MB.
 */
export const BODY_LIMIT = 100 * 1024 * 1024;
/** Internal mount point of the SPA — never visible to clients, only the rewrite target. */
const WEB_PREFIX = "/__web";
const UNPREFIXED = /^\/(healthz|_svc)(\/|\?|$)/;

/** Fastify `rewriteUrl`: /api/x -> /x, infra paths unchanged, everything else -> the SPA mount. */
export function webappRewriteUrl(req: { url?: string }): string {
  const url = req.url ?? "/";
  if (url === API_PREFIX || url.startsWith(`${API_PREFIX}/`) || url.startsWith(`${API_PREFIX}?`)) {
    const rest = url.slice(API_PREFIX.length);
    if (!rest) return "/";
    return rest.startsWith("?") ? `/${rest}` : rest;
  }
  if (UNPREFIXED.test(url)) return url;
  return WEB_PREFIX + (url.startsWith("/") ? url : `/${url}`);
}

export interface WebappOptions {
  /** Directory holding the Vite build (index.html + assets). Missing dir = API-only (dev, tests). */
  distDir: string;
  /** Public URL of the TwoDB console (login). Default: env TWODB_CONSOLE_URL. Injected into index.html at runtime. */
  consoleUrl?: string;
}

/** Serves the built SPA under the internal mount; returns false when there is no build (API-only). */
export async function registerWebapp(app: FastifyInstance, options: WebappOptions): Promise<boolean> {
  const indexFile = path.join(options.distDir, "index.html");
  if (!existsSync(indexFile)) {
    app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: "not found" }));
    return false;
  }

  const consoleUrl = options.consoleUrl ?? process.env.TWODB_CONSOLE_URL ?? null;
  // Runtime config for the SPA (see core/twodb-shared-frontend resolveConfig): one image, any domain.
  const injected = `<script>window.__TWODB_CONFIG__=${JSON.stringify({ twodbUrl: consoleUrl }).replace(/</g, "\\u003c")};</script>`;
  const raw = readFileSync(indexFile, "utf8");
  const html = raw.includes("</head>") ? raw.replace("</head>", `${injected}</head>`) : injected + raw;

  const sendIndex = (reply: FastifyReply) => reply.header("cache-control", "no-cache").type("text/html; charset=utf-8").send(html);
  await app.register(fastifyStatic, { root: options.distDir, prefix: `${WEB_PREFIX}/`, wildcard: true, index: false });
  // The app root ("/") — a directory as far as the static plugin is concerned, so serve index.html explicitly.
  app.get(`${WEB_PREFIX}/`, async (_req, reply) => sendIndex(reply));
  app.setNotFoundHandler((req, reply) => {
    const pathname = new URL(req.url, "http://internal").pathname;
    const isSpaRoute = pathname.startsWith(`${WEB_PREFIX}/`) || pathname === WEB_PREFIX;
    if ((req.method === "GET" || req.method === "HEAD") && isSpaRoute && !path.extname(pathname)) return sendIndex(reply);
    return reply.code(404).send({ error: "not found" });
  });
  return true;
}

/**
 * Absolute URL of another app's web UI. Prefers env TWODB_APP_URL_TEMPLATE (e.g. `https://{slug}.twodb.io`),
 * falling back to the gateway path mount used in local dev.
 */
export function appUiUrl(slug: string, uiPath = "/"): string {
  const tpl = process.env.TWODB_APP_URL_TEMPLATE;
  const base = tpl
    ? tpl.replace("{slug}", slug)
    : `${(process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400").replace(/\/+$/, "")}/apps/${slug}`;
  return base.replace(/\/+$/, "") + (uiPath.startsWith("/") ? uiPath : `/${uiPath}`);
}

/** Conventional dist location for an app: `<app>/webapp/dist`, given the app's `src` directory (import.meta.dirname). */
export function webappDist(srcDir: string): string {
  return path.join(srcDir, "../webapp/dist");
}
