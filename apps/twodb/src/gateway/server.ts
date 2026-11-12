import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Kysely } from "kysely";
import type { ControlPlaneDb } from "../db/sqlite.js";
import { createRegistryRepo } from "../db/registry.js";
import { setupAuth } from "../auth/index.js";
import type { TwoDbConfig } from "../config.js";
import { decryptSecret, encryptSecret } from "../db/provisioning.js";
import { toWebRequest, sendWebResponse } from "./web-request.js";
import { proxyToApp } from "./proxy.js";
import { isInternalPath } from "./ws-paths.js";
import { createOAuthFlow, OAuthError, isAllowedRedirect } from "../auth/oauth.js";
import { registerWsPassthrough } from "./ws-passthrough.js";
import { federatedSearch } from "./federated-search.js";
import { APP_CATALOG, getCatalogEntry } from "../orchestrator/catalog.js";
import {
  installApp,
  startApp,
  stopApp,
  restartApp,
  upgradeApp,
  removeApp,
  getContainerStatus,
  issueApiToken,
  rotateAppToken,
  provisionDatabase,
} from "../orchestrator/install.js";

// apps/twodb/src/gateway/server.ts -> repo root
const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");

declare module "fastify" {
  interface FastifyRequest {
    /** Result of screening x-twodb-app / x-twodb-token in the gateway's onRequest hook. */
    callerApp: { slug: string | null; verified: boolean; kind: "managed" | "api" | null };
  }
}

export async function buildServer(db: Kysely<ControlPlaneDb>, config: TwoDbConfig) {
  const app = Fastify({ logger: true });
  await app.register(cors, {
    // Trusted origins + app webapps allowed to run "Login with TwoDB" (same rule as the redirect check).
    origin: (origin, cb) => cb(null, !origin || config.AUTH_TRUSTED_ORIGINS.includes(origin) || isAllowedRedirect(origin, config)),
    credentials: true,
  });

  // Preserve non-JSON request bodies as raw Buffers so the proxy can
  // forward them byte-for-byte — Fastify's default 415s unknown content
  // types, and JSON bodies get re-serialized in toWebRequest either way.
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));

  const registry = createRegistryRepo(db);
  const { resolveContext, authEngine, workspacePlatform } = setupAuth(db, config);

  // --- Identity: better-auth owns everything under /api/auth/* -----------
  app.all("/api/auth/*", async (req, reply) => {
    const response = await authEngine.handler(toWebRequest(req));
    await sendWebResponse(reply, response);
  });

  // --- "Login with TwoDB" (authorization code + PKCE; see auth/oauth.ts) ----
  const oauth = createOAuthFlow(db, config);

  /** Called by the TwoDB webapp's /authorize page, with the user's own session. Returns where to send the browser. */
  app.post("/registry/oauth/authorize", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx || ctx.kind !== "session" || !ctx.userId) return reply.code(401).send({ error: "unauthorized" });
    const b = (req.body ?? {}) as { redirectUri?: string; codeChallenge?: string; state?: string };
    if (!b.redirectUri || !b.codeChallenge) return reply.code(400).send({ error: "redirectUri and codeChallenge are required" });
    try {
      return await oauth.authorize({ userId: ctx.userId, redirectUri: b.redirectUri, codeChallenge: b.codeChallenge, state: b.state });
    } catch (err) {
      if (err instanceof OAuthError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  /** Public (PKCE is the proof): exchanges the code for a session token usable as `Authorization: Bearer`. */
  app.post("/registry/oauth/token", async (req, reply) => {
    const b = (req.body ?? {}) as { code?: string; codeVerifier?: string; redirectUri?: string };
    if (!b.code || !b.codeVerifier || !b.redirectUri) return reply.code(400).send({ error: "code, codeVerifier and redirectUri are required" });
    reply.header("cache-control", "no-store");
    try {
      const { userId } = await oauth.redeem({ code: b.code, codeVerifier: b.codeVerifier, redirectUri: b.redirectUri });
      const authCtx = await authEngine.$context;
      const ttl = config.TWODB_APP_SESSION_DAYS * 24 * 60 * 60;
      const session = await authCtx.internalAdapter.createSession(userId, false, {
        expiresAt: new Date(Date.now() + ttl * 1000),
        userAgent: String(req.headers["user-agent"] ?? "").slice(0, 200),
        ipAddress: req.ip,
      });
      if (!session) return reply.code(500).send({ error: "could not create session" });
      return { tokenType: "Bearer", accessToken: session.token, expiresAt: session.expiresAt };
    } catch (err) {
      if (err instanceof OAuthError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  // --- Caller-app identity (x-twodb-app + x-twodb-token) ----------------
  // Every request is screened here, BEFORE routing: the token header is
  // always removed (it never travels further than this hook), and the result
  // is recorded as `x-gateway-verified: true|false` — an inbound value of
  // that header is never trusted. Registry endpoints below read
  // `req.callerApp`; the proxy forwards `x-gateway-verified` (+ `x-twodb-app`
  // when verified) to the target app.
  app.decorateRequest("callerApp", null as any);
  // EventSource can't set headers either: for GET, promote ?access_token= (what the webapp lib
  // appends) to Authorization and strip it from the URL so it is never forwarded or logged downstream.
  app.addHook("onRequest", async (req) => {
    if (req.method !== "GET" || !req.url.includes("access_token=")) return;
    const u = new URL(req.url, "http://internal");
    const t = u.searchParams.get("access_token");
    if (!t) return;
    u.searchParams.delete("access_token");
    if (!req.headers.authorization && !req.headers["x-api-key"]) req.headers.authorization = `Bearer ${t}`;
    req.raw.url = u.pathname + u.search;
  });
  app.addHook("onRequest", async (req) => {
    const slug = (req.headers["x-twodb-app"] as string | undefined)?.trim() || null;
    const token = (req.headers["x-twodb-token"] as string | undefined)?.trim() || null;
    delete req.headers["x-twodb-token"];
    delete req.headers["x-gateway-verified"];
    let verified: { kind: "managed" | "api" } | null = null;
    if (slug && token) verified = await registry.verifyToken(slug, token).catch(() => null);
    req.callerApp = { slug, verified: Boolean(verified), kind: verified?.kind ?? null };
    req.headers["x-gateway-verified"] = verified ? "true" : "false";
  });

  // --- User vs machine requests -------------------------------------------
  // Anything under an `internal` path segment is user-session only: API keys
  // and app tokens are rejected with 403, anonymous callers with 401.
  app.addHook("onRequest", async (req, reply) => {
    if (!isInternalPath(new URL(req.url, "http://internal").pathname)) return;
    const ctx = await resolveContext(new Headers(req.headers as any)).catch(() => null);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    if (ctx.kind !== "session") {
      return reply.code(403).send({ error: "internal endpoints require an interactive user session — API keys and app tokens are not accepted" });
    }
  });

  const secretMatches = (presented: unknown): boolean => {
    const expected = config.TWODB_REGISTRATION_SECRET;
    if (!expected || typeof presented !== "string") return false;
    const a = createHash("sha256").update(presented).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
  };

  const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

  /**
   * App-initiated registration — the only way an app becomes known to the
   * gateway (managed containers do exactly the same thing with the token
   * TwoDB injected). Authenticates either with a live app token for the
   * slug (re-register after restart) or with the shared
   * TWODB_REGISTRATION_SECRET (header x-twodb-registration-secret), in which
   * case a fresh 30-day token is minted and returned — store it, send it as
   * `x-twodb-token`.
   */
  app.post("/registry/register", async (req, reply) => {
    const body = (req.body ?? {}) as {
      slug?: string;
      name?: string;
      version?: string;
      httpUrl?: string;
      socketPath?: string;
      capabilities?: string[];
      manifest?: unknown;
    };
    const slug = body.slug?.trim().toLowerCase();
    if (!slug || !SLUG_RE.test(slug) || slug === "twodb") return reply.code(400).send({ error: "slug must be kebab-case and not reserved" });
    if (!body.httpUrl || !/^https?:\/\//.test(body.httpUrl)) return reply.code(400).send({ error: "httpUrl must be an http(s) URL" });

    let issued: { token: string; expiresAt: string | null } | null = null;
    const tokenOk = req.callerApp.verified && req.callerApp.slug === slug;
    if (!tokenOk) {
      if (!secretMatches(req.headers["x-twodb-registration-secret"])) {
        return reply.code(401).send({ error: "invalid or missing app token / registration secret" });
      }
      const t = await issueApiToken(slug, { registry, config });
      issued = { token: t.appToken, expiresAt: t.expiresAt };
    }

    const { created } = await registry.registerApp({
      slug,
      name: body.name,
      version: body.version,
      httpUrl: body.httpUrl,
      socketPath: body.socketPath,
      capabilities: body.capabilities,
      manifestJson: body.manifest,
      hostId: config.TWODB_HOST_ID,
    });
    return { ok: true, created, ...(issued ? { token: issued.token, expiresAt: issued.expiresAt } : {}) };
  });

  /** Heartbeat: apps ping every ~10s; the control plane marks an app inactive after TWODB_HEARTBEAT_TIMEOUT_MS (30s) of silence. */
  app.post("/registry/ping", async (req, reply) => {
    if (!req.callerApp.verified || !req.callerApp.slug) return reply.code(401).send({ error: "invalid app token" });
    const known = await registry.ping(req.callerApp.slug);
    if (!known) return reply.code(404).send({ error: "app not registered — call /registry/register" });
    return { ok: true, pong: true, intervalMs: 10_000, timeoutMs: config.TWODB_HEARTBEAT_TIMEOUT_MS };
  });

  /**
   * Runtime config for an authenticated app: its Postgres schema/role/
   * connection string, its S3 location and its stable data key. This is what
   * `twodb-core` calls on boot — apps carry no DATABASE_URL / S3 env.
   * Connection host: containers (managed token) get the docker-network
   * form; everything else gets the admin URL's own host:port.
   */
  app.get("/registry/config", async (req, reply) => {
    const slug = req.callerApp.slug;
    if (!req.callerApp.verified || !slug) return reply.code(401).send({ error: "invalid app token" });
    const row = await registry.getApp(slug);
    if (!row) return reply.code(404).send({ error: `"${slug}" is not registered` });

    let containerUrl: string | null = null;
    if (row.pg_connection_string_encrypted && row.pg_schema && row.pg_role) {
      try {
        containerUrl = decryptSecret(row.pg_connection_string_encrypted, config.AUTH_SECRET);
      } catch {
        app.log.warn({ slug }, "stored credentials failed to decrypt — re-provisioning");
      }
    }
    // First contact (unmanaged app) or stale ciphertext: provision now.
    // NB: provisioning resets the role password, so never do it when valid creds exist.
    let schema = row.pg_schema;
    let role = row.pg_role;
    if (!containerUrl) {
      const p = await provisionDatabase(slug, { registry, config });
      containerUrl = p.containerConnectionString;
      schema = p.schema;
      role = p.role;
    }

    let connectionString = containerUrl;
    if (req.callerApp.kind !== "managed") {
      const admin = new URL(config.TWODB_PG_ADMIN_URL);
      const u = new URL(containerUrl);
      u.hostname = admin.hostname;
      u.port = admin.port || "5432";
      connectionString = u.toString();
    }

    let dataKey: string | undefined = undefined;
    const fresh = await registry.getApp(slug);
    if (fresh?.data_key_encrypted) {
      try {
        dataKey = decryptSecret(fresh.data_key_encrypted, config.AUTH_SECRET);
      } catch {
        app.log.warn({ slug }, "stored data key failed to decrypt — omitting");
      }
    } else {
      dataKey = randomBytes(32).toString("hex");
      await registry.setDataKey(slug, encryptSecret(dataKey, config.AUTH_SECRET));
    }

    const s3 =
      config.TWODB_S3_BUCKET && config.TWODB_S3_ACCESS_KEY_ID && config.TWODB_S3_SECRET_ACCESS_KEY
        ? {
            bucket: config.TWODB_S3_BUCKET,
            prefix: `${slug}/`,
            region: config.TWODB_S3_REGION ?? null,
            endpoint: config.TWODB_S3_ENDPOINT ?? null,
            forcePathStyle: config.TWODB_S3_FORCE_PATH_STYLE ?? Boolean(config.TWODB_S3_ENDPOINT),
            accessKeyId: config.TWODB_S3_ACCESS_KEY_ID,
            secretAccessKey: config.TWODB_S3_SECRET_ACCESS_KEY,
          }
        : null;

    return {
      slug,
      postgres: { connectionString, schema, role },
      s3,
      ...(dataKey ? { dataKey } : {}),
    };
  });

  // --- App tokens (session-only admin API) -------------------------------
  app.get("/registry/apps/:slug/tokens", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx || ctx.kind !== "session") return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    return { tokens: await registry.listTokens(slug) };
  });

  /** Mints a token (expiry TWODB_APP_TOKEN_TTL_DAYS, default 30d) for an app TwoDB doesn't run. Plaintext is returned once. */
  app.post("/registry/apps/:slug/tokens", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx || ctx.kind !== "session") return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    if (!SLUG_RE.test(slug) || slug === "twodb") return reply.code(400).send({ error: "invalid slug" });
    const t = await issueApiToken(slug, { registry, config });
    return { token: t.appToken, expiresAt: t.expiresAt };
  });

  /** Rotate an app's token from the UI (session only). Unmanaged: new token returned once. Managed: container is recreated async. */
  app.post("/registry/apps/:slug/rotate-token", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx || ctx.kind !== "session") return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    if (slug === "twodb") return reply.code(400).send({ error: "the control plane has no app token" });
    try {
      const r = await rotateAppToken(slug, { registry, config });
      if (r.managed) {
        runLifecycle(slug, r.run);
        return { ok: true, managed: true, status: "installing" };
      }
      return { ok: true, managed: false, token: r.appToken, expiresAt: r.expiresAt };
    } catch (err) {
      return reply.code(500).send({ error: String(err) });
    }
  });

  app.delete("/registry/tokens/:id", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx || ctx.kind !== "session") return reply.code(401).send({ error: "unauthorized" });
    await registry.revokeTokenById((req.params as { id: string }).id);
    return { ok: true };
  });

  // Liveness sweep: apps ping every 10s; silence for >30s => inactive.
  const sweeper = setInterval(() => {
    registry
      .markStale(new Date(Date.now() - config.TWODB_HEARTBEAT_TIMEOUT_MS).toISOString())
      .catch((err) => app.log.warn({ err }, "heartbeat sweep failed"));
  }, 10_000);
  sweeper.unref();
  app.addHook("onClose", async () => clearInterval(sweeper));

  app.get("/registry/apps", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const apps = await registry.listApps();
    return apps.map((a) => ({
      slug: a.slug,
      // Display name: the catalog's brand name when known (rows seeded before names were stored
      // hold the lowercase slug), else what the app reported.
      name: getCatalogEntry(a.slug)?.name ?? a.name,
      basePath: a.base_path,
      status: a.status,
      installStatus: a.install_status,
      version: a.version,
      managed: a.managed === 1,
      httpUrl: a.http_url,
      capabilities: JSON.parse(a.capabilities || "[]"),
    }));
  });

  /** Register an external (unmanaged) app: URL-based entry for the gateway; lifecycle stays with the app. */
  app.post("/registry/apps/external", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const body = req.body as { slug?: string; name?: string; httpUrl?: string; basePath?: string; capabilities?: string[] };
    if (!body?.slug || !body?.name || !body?.httpUrl) return reply.code(400).send({ error: "slug, name and httpUrl are required" });
    const result = await registry.registerExternal({
      slug: body.slug,
      name: body.name,
      httpUrl: body.httpUrl,
      basePath: body.basePath,
      capabilities: body.capabilities,
    });
    if (!result.ok) return reply.code(409).send({ error: result.reason });
    return { ok: true };
  });

  app.get("/registry/apps/:slug/endpoint.json", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    const row = await registry.getApp(slug);
    if (!row) return reply.code(404).send({ error: "not found" });
    reply.type("application/json");
    if (row.manifest_json) return row.manifest_json;
    // External apps never self-report at boot — fall back to the checked-in
    // endpoint.json from TwoDB's own monorepo checkout (same strategy as
    // messages.json below).
    try {
      const file = path.join(REPO_ROOT, "apps", slug, "endpoint.json");
      return await fs.readFile(file, "utf8");
    } catch {
      return reply.code(404).send({ error: "not found" });
    }
  });

  // Messages contract (jobs + broadcast events) isn't part of the
  // self-reported manifest — apps generate their own messages.json from
  // messages.ts, so TwoDB serves the checked-in copy from its own monorepo
  // checkout rather than asking the app for it.
  app.get("/registry/apps/:slug/messages.json", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    try {
      const file = path.join(REPO_ROOT, "apps", slug, "messages.json");
      const content = await fs.readFile(file, "utf8");
      return reply.type("application/json").send(content);
    } catch {
      return reply.code(404).send({ error: `no messages contract for "${slug}"` });
    }
  });

  // --- Orchestrator: install/lifecycle-manage apps via Docker -------------
  app.get("/orchestrator/catalog", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    return APP_CATALOG.map((e) => ({ slug: e.slug, hostPort: e.hostPort }));
  });

  // --- API keys (workspace platform's api_key table — what x-api-key auth
  // verifies against). Session-only: creating keys is an interactive act. ---
  app.get("/registry/api-keys", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx || ctx.kind !== "session") return reply.code(401).send({ error: "unauthorized" });
    return { keys: await workspacePlatform.listApiKeys(ctx.workspaceId) };
  });

  // --- Spaces: the workspace's sub-scopes that apps (e.g. TwoRoute
  // connections) link themselves to. Session-only, workspace-scoped. ---
  app.get("/registry/spaces", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx || ctx.kind !== "session") return reply.code(401).send({ error: "unauthorized" });
    const spaces = await workspacePlatform.listSpaces(ctx.workspaceId);
    return { spaces: spaces.map((s) => ({ id: s.id, name: s.name, createdAt: (s as any).created_at ?? null })) };
  });

  // --- Members: users of the caller's workspace (id + display fields), so apps can
  // render assignee pickers/avatars without owning user data. Session-only. ---
  app.get("/registry/members", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx || ctx.kind !== "session") return reply.code(401).send({ error: "unauthorized" });
    const rows = await (db as any)
      .selectFrom("workspace_member")
      .innerJoin("user", "user.id", "workspace_member.user_id")
      .select(["user.id as id", "user.name as name", "user.email as email", "user.image as image", "workspace_member.role as role"])
      .where("workspace_member.workspace_id", "=", ctx.workspaceId)
      .orderBy("user.name")
      .execute();
    return { members: rows, me: ctx.userId };
  });

  app.post("/registry/spaces", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx || ctx.kind !== "session") return reply.code(401).send({ error: "unauthorized" });
    const body = req.body as { name?: string };
    const name = body?.name?.trim();
    if (!name) return reply.code(400).send({ error: "name is required" });
    // Same workspace as the caller's — spaces can't be created cross-workspace.
    const space = await workspacePlatform.createSpace(ctx.workspaceId, name);
    return { space: { id: space.id, name: space.name } };
  });

  app.post("/registry/api-keys", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx || ctx.kind !== "session") return reply.code(401).send({ error: "unauthorized" });
    const body = req.body as { name?: string };
    const name = body?.name?.trim();
    if (!name) return reply.code(400).send({ error: "name is required" });
    // Raw key returned exactly once — only its sha256 is stored.
    const issued = await workspacePlatform.issueApiKey(ctx.workspaceId, ctx.userId!, name);
    return {
      key: {
        id: issued.id,
        name: issued.name,
        prefix: issued.prefix,
        scopes: JSON.parse(issued.scopes) as string[],
        createdAt: issued.created_at,
        lastUsedAt: null,
        revokedAt: null,
      },
      rawKey: issued.rawKey,
    };
  });

  app.delete("/registry/api-keys/:id", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx || ctx.kind !== "session") return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    // Only revoke keys that belong to the caller's workspace — never by bare id.
    const keys = await workspacePlatform.listApiKeys(ctx.workspaceId);
    if (!keys.some((k) => k.id === id)) return reply.code(404).send({ error: "not found" });
    await workspacePlatform.revokeApiKey(id);
    return { ok: true };
  });

  /**
   * Runs a long-lived lifecycle operation (docker build + run can take
   * minutes on first install) in the background so the HTTP call returns
   * immediately. Failures are recorded as install_status "failed" and
   * logged — clients poll `GET /orchestrator/apps/:slug/status`.
   */
  function runLifecycle(slug: string, op: () => Promise<void>) {
    void op().catch(async (err) => {
      app.log.error({ err, slug }, "lifecycle operation failed");
      await registry.setInstallStatus(slug, "failed").catch(() => {});
    });
  }

  /** 409s for external apps: their lifecycle belongs to whoever runs them, not us. */
  async function requireManaged(slug: string, reply: unknown): Promise<boolean> {
    const row = await registry.getApp(slug);
    if (row && row.managed === 0) {
      (reply as any).code(409).send({ error: `"${slug}" is an external (unmanaged) app — its lifecycle is owned outside the control plane` });
      return false;
    }
    return true;
  }

  app.post("/orchestrator/apps/:slug/install", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    if (!(await requireManaged(slug, reply))) return;
    const version = (req.body as { version?: string } | null)?.version;
    try {
      runLifecycle(slug, () => installApp(slug, { registry, config }, version));
      return { ok: true, status: "installing" };
    } catch (err) {
      return reply.code(500).send({ error: String(err) });
    }
  });

  // --- Dev-mode primitives: same token/DB provisioning as a full install,
  // without touching Docker — for running an app directly via `pnpm dev`
  // instead of as a container. See apps/<slug>/README.md "Local dev" for
  // the exact steps.
  app.post("/orchestrator/apps/:slug/issue-token", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    try {
      const { appToken, expiresAt } = await issueApiToken(slug, { registry, config });
      return { appToken, expiresAt };
    } catch (err) {
      return reply.code(500).send({ error: String(err) });
    }
  });

  app.post("/orchestrator/apps/:slug/provision-db", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    try {
      const rotate = Boolean((req.body as { rotate?: boolean } | null)?.rotate);
      const result = await provisionDatabase(slug, { registry, config }, { rotate });
      return result;
    } catch (err) {
      return reply.code(500).send({ error: String(err) });
    }
  });

  app.post("/orchestrator/apps/:slug/start", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    if (!(await requireManaged(slug, reply))) return;
    await startApp(slug, { registry, config });
    return { ok: true };
  });

  app.post("/orchestrator/apps/:slug/stop", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    if (!(await requireManaged(slug, reply))) return;
    await stopApp(slug, { registry, config });
    return { ok: true };
  });

  app.post("/orchestrator/apps/:slug/restart", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    if (!(await requireManaged(slug, reply))) return;
    await restartApp(slug, { registry, config });
    return { ok: true };
  });

  app.post("/orchestrator/apps/:slug/upgrade", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    if (!(await requireManaged(slug, reply))) return;
    const version = (req.body as { version?: string } | null)?.version;
    try {
      runLifecycle(slug, () => upgradeApp(slug, { registry, config }, version));
      return { ok: true, status: "installing" };
    } catch (err) {
      return reply.code(500).send({ error: String(err) });
    }
  });

  app.delete("/orchestrator/apps/:slug", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    const row = await registry.getApp(slug);
    if (row?.managed === 0) {
      await registry.remove(slug);
      return { ok: true };
    }
    await removeApp(slug, { registry, config });
    return { ok: true };
  });

  app.get("/orchestrator/apps/:slug/status", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    const row = await registry.getApp(slug);
    const containerStatus = await getContainerStatus(slug, { registry, config });
    return {
      slug,
      installStatus: row?.install_status ?? "not_installed",
      registrationStatus: row?.status ?? "unknown",
      containerStatus,
      version: row?.version ?? null,
      imageTag: row?.image_tag ?? null,
      lastSeenAt: row?.last_seen_at ?? null,
    };
  });

  // --- Federated search (v1: manifest-declared capability fan-out) -------
  app.post("/search", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { query } = req.body as { query: string };
    const results = await federatedSearch(registry, ctx, query);
    return { results };
  });

  // --- Generic app proxy: everything else goes through here ---------------
  app.all("/apps/:slug/*", async (req, reply) => {
    const { slug } = req.params as { slug: string; "*": string };
    const app_ = await registry.getApp(slug);
    // Registered row is enough to proxy: external apps never self-report a
    // manifest at boot, so an empty manifest_json must not block their traffic.
    if (!app_) {
      return reply.code(404).send({ error: `app "${slug}" is not registered` });
    }

    const ctx = await resolveContext(
      new Headers(req.headers as any),
      (req.headers["x-twodb-workspace-id"] as string) ?? null,
      (req.headers["x-twodb-space-ids"] as string) ?? null,
    );
    const subPath = req.url.replace(new RegExp(`^/apps/${slug}`), "") || "/";
    // Anonymous read-only exception: GET /apps/<slug>/public/* (share links etc.) is proxied
    // WITHOUT identity — the app declares such endpoints auth:"public" and validates its own token.
    if (!ctx) {
      if (req.method === "GET" && /^\/public\/[A-Za-z0-9_-]+(\?.*)?$/.test(subPath)) return proxyToApp(req, reply, app_, subPath, null);
      return reply.code(401).send({ error: "unauthorized" });
    }
    await proxyToApp(req, reply, app_, subPath, ctx);
  });

  app.get("/healthz", async () => ({ ok: true }));

  // --- WebSocket passthrough (see ws-passthrough.ts) ---------------------
  // Attached to the raw http.Server so upgrade requests never hit the
  // Fastify router. __resolveContext is consumed by the passthrough for
  // caller-side upgrades (it re-resolves identity from raw headers).
  const serverAny = app as unknown as {
    __resolveContext: (h: Headers, a?: string | null, b?: string | null) => Promise<unknown>;
  };
  serverAny.__resolveContext = resolveContext as unknown as typeof serverAny.__resolveContext;
  registerWsPassthrough(app, (slug) => registry.getApp(slug), (slug, token) => registry.verifyToken(slug, token));

  // --- Admin webapp: serve the built SPA when its dist exists (production
  // image builds it; dev uses the Vite dev server on :6500 instead).
  const webappDist = path.join(REPO_ROOT, "apps/twodb/webapp/dist");
  if (existsSync(path.join(webappDist, "index.html"))) {
    await app.register(fastifyStatic, { root: webappDist, wildcard: false, index: false });
    app.setNotFoundHandler((req, reply) => {
      const pathname = new URL(req.url, "http://internal").pathname;
      const isApi = /^\/(api|registry|orchestrator|apps|search|healthz)(\/|$)/.test(pathname);
      const wantsHtml =
        !isApi &&
        ((req.headers.accept ?? "").includes("text/html") || (req.method === "GET" && !path.extname(pathname)));
      if (req.method === "GET" && wantsHtml) return reply.sendFile("index.html");
      return reply.code(404).send({ error: "not found" });
    });
  }

  return app;
}
