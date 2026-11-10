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
  const { resolveContext, authEngine } = setupAuth(db, config);

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
    }));
  });

  app.get("/registry/apps/:slug/endpoint.json", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    const row = await registry.getApp(slug);
    if (!row || !row.manifest_json) return reply.code(404).send({ error: "not found" });
    reply.type("application/json");
    return row.manifest_json;
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

  app.post("/orchestrator/apps/:slug/install", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
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
    await startApp(slug, { registry, config });
    return { ok: true };
  });

  app.post("/orchestrator/apps/:slug/stop", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    await stopApp(slug, { registry, config });
    return { ok: true };
  });

  app.post("/orchestrator/apps/:slug/restart", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    await restartApp(slug, { registry, config });
    return { ok: true };
  });

  app.post("/orchestrator/apps/:slug/upgrade", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
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
    if (!app_ || !app_.manifest_json) {
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

  // --- Admin webapp: serve the built SPA when its dist exists (production
  // image builds it; dev uses the Vite dev server on :5173 instead).
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
