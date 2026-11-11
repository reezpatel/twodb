import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import * as path from "node:path";
import type { Kysely } from "kysely";
import type { ControlPlaneDb } from "../db/sqlite.js";
import { createRegistryRepo } from "../db/registry.js";
import { setupAuth } from "../auth/index.js";
import type { TwoDbConfig } from "../config.js";
import { toWebRequest, sendWebResponse } from "./web-request.js";
import { proxyToApp } from "./proxy.js";
import { registerWsPassthrough } from "./ws-passthrough.js";
import { federatedSearch } from "./federated-search.js";
import { APP_CATALOG } from "../orchestrator/catalog.js";
import {
  installApp,
  startApp,
  stopApp,
  restartApp,
  upgradeApp,
  removeApp,
  getContainerStatus,
  issueRegistrationToken,
  provisionDatabase,
} from "../orchestrator/install.js";

// apps/twodb/src/gateway/server.ts -> repo root
const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");

export async function buildServer(db: Kysely<ControlPlaneDb>, config: TwoDbConfig) {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: config.AUTH_TRUSTED_ORIGINS, credentials: true });

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

  // --- Registry: an installed app calls this once it boots, presenting the
  // unique per-app token TwoDB generated for it at install time (see
  // orchestrator/install.ts). There is no shared secret anymore — a stolen
  // token only ever impersonates the one app it was issued for, and is
  // rotated automatically on every (re)install/upgrade.
  app.post("/registry/register", async (req, reply) => {
    const body = req.body as {
      slug: string;
      registrationToken: string;
      httpUrl: string;
      socketPath?: string;
      manifest: unknown;
    };

    const result = await registry.completeRegistration({
      slug: body.slug,
      registrationToken: body.registrationToken,
      httpUrl: body.httpUrl,
      socketPath: body.socketPath,
      manifestJson: body.manifest,
    });

    if (!result.ok) return reply.code(401).send({ error: result.reason });
    return { ok: true };
  });

  app.get("/registry/apps", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const apps = await registry.listApps();
    return apps.map((a) => ({
      slug: a.slug,
      name: a.name,
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
      const result = await issueRegistrationToken(slug, { registry, config });
      return result;
    } catch (err) {
      return reply.code(500).send({ error: String(err) });
    }
  });

  app.post("/orchestrator/apps/:slug/provision-db", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    try {
      const result = await provisionDatabase(slug, { registry, config });
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
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });

    const subPath = req.url.replace(new RegExp(`^/apps/${slug}`), "") || "/";
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
  registerWsPassthrough(app, (slug) => registry.getApp(slug));

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
