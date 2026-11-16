import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isIP } from "node:net";
import { headersFor, resolveRequest } from "./match.js";
import { normalizeHost, type SiteResolver } from "./resolver.js";
import { safeHeaderValue } from "./paths.js";
import type { Blobs } from "../lib/blobs.js";

/** Internal mount for site traffic — the rewrite target (see `siteRewriteUrl`), never visible to clients. */
export const SITE_PREFIX = "/__site";

const BLOCKED_HEADERS = new Set(["content-length", "transfer-encoding", "connection", "content-encoding", "host", "set-cookie", "upgrade", "keep-alive", "te", "trailer"]);

export function requestHost(req: { headers: Record<string, string | string[] | undefined> }): string | null {
  const h = req.headers["x-forwarded-host"] ?? req.headers.host;
  return normalizeHost(Array.isArray(h) ? h[0] : h);
}

/**
 * Hosts that show the admin UI instead of a site: the configured ADMIN_HOSTS, localhost, IPs and single-label
 * names (docker-internal service names). Everything else — i.e. any real domain — is site traffic.
 */
export function createAdminHostCheck(adminHosts: string): (host: string | null) => boolean {
  const set = new Set(adminHosts.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean));
  return (host) => !host || set.has(host) || host === "localhost" || host.endsWith(".localhost") || isIP(host) !== 0 || !host.includes(".");
}

const page = (title: string, body: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
  `<body style="font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#444"><div style="text-align:center"><h1 style="margin:0 0 .25em">${title}</h1><p style="margin:0">${body}</p></div></body>`;

export function registerSiteServing(app: FastifyInstance, deps: { resolver: SiteResolver; blobs: Blobs }) {
  const send404 = (reply: FastifyReply, title: string, body: string) =>
    reply.code(404).header("cache-control", "no-store").type("text/html; charset=utf-8").send(page(title, body));

  const serve = async (req: FastifyRequest, reply: FastifyReply) => {
    const host = requestHost(req);
    const live = host ? await deps.resolver.forHost(host) : null;
    if (!live) return send404(reply, "Nothing here yet", "No site is published on this address.");

    const rest = (req.raw.url ?? "/").slice(SITE_PREFIX.length) || "/";
    const u = new URL(rest.startsWith("/") || rest.startsWith("?") ? `http://site${rest}` : `http://site/${rest}`);
    let pathname: string;
    try {
      pathname = decodeURIComponent(u.pathname).replace(/\/{2,}/g, "/");
    } catch {
      return reply.code(400).send("bad request");
    }
    if (pathname.includes("\0")) return reply.code(400).send("bad request");

    const res = resolveRequest(pathname, live.files, live.config, u.search);
    if (res.kind === "redirect") return reply.header("cache-control", "no-cache").redirect(res.location, res.status);
    if (res.kind === "notfound") return send404(reply, "404", "Page not found.");

    const { file } = res;
    const etag = `"${file.sha256.slice(0, 32)}"`;
    const isHtml = file.contentType.startsWith("text/html");
    reply
      .code(res.status)
      .header("content-type", file.contentType)
      .header("etag", etag)
      .header("x-content-type-options", "nosniff")
      .header("x-twopager-version", String(live.versionNumber))
      .header("cache-control", res.status === 404 ? "no-cache" : isHtml ? "public, max-age=0, must-revalidate" : "public, max-age=3600");
    for (const [k, v] of Object.entries(headersFor(pathname, live.config))) {
      if (!BLOCKED_HEADERS.has(k) && safeHeaderValue(v)) reply.header(k, v);
    }
    if (res.status === 200 && req.headers["if-none-match"]?.split(",").some((t) => t.trim() === etag || t.trim() === `W/${etag}`)) {
      return reply.code(304).send();
    }

    let localPath: string;
    try {
      localPath = await deps.blobs.localPath(live.siteId, file.sha256);
    } catch (err) {
      req.log.error({ err, siteId: live.siteId, path: file.path }, "site file unavailable");
      return reply.code(502).header("cache-control", "no-store").type("text/plain").send("file temporarily unavailable");
    }
    reply.header("content-length", String(file.size));
    return reply.send(deps.blobs.cache.stream(localPath));
  };

  app.get(`${SITE_PREFIX}/*`, serve);
  app.route({
    method: ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    url: `${SITE_PREFIX}/*`,
    handler: async (_req, reply) => reply.code(405).header("allow", "GET, HEAD").send("method not allowed"),
  });
}
