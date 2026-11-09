import Fastify from "fastify";
import cors from "@fastify/cors";
import type { Kysely } from "kysely";
import type { ControlPlaneDb } from "../db/sqlite.js";
import { createRegistryRepo } from "../db/registry.js";
import { provisionAppDatabase, encryptSecret } from "../db/provisioning.js";
import { setupAuth } from "../auth/index.js";
import type { TwoDbConfig } from "../config.js";
import { toWebRequest, sendWebResponse } from "./web-request.js";
import { proxyToApp } from "./proxy.js";
import { federatedSearch } from "./federated-search.js";

const HOST_ID = process.env.TWODB_HOST_ID ?? "local";

export async function buildServer(db: Kysely<ControlPlaneDb>, config: TwoDbConfig) {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: config.AUTH_TRUSTED_ORIGINS, credentials: true });

  const registry = createRegistryRepo(db);
  const { authEngine, resolveContext } = setupAuth(db, config);

  // --- Identity: better-auth owns everything under /api/auth/* -----------
  app.all("/api/auth/*", async (req, reply) => {
    const response = await authEngine.handler(toWebRequest(req));
    await sendWebResponse(reply, response);
  });

  // --- Registry: apps self-register here on boot --------------------------
  app.post("/registry/register", async (req, reply) => {
    // Dev-grade shared-secret guard. Swap for mTLS/network isolation before
    // any real multi-host deployment.
    if (req.headers["x-provision-token"] !== config.AUTH_SECRET) {
      return reply.code(401).send({ error: "invalid provision token" });
    }
    const body = req.body as {
      slug: string;
      name: string;
      version: string;
      shape: string;
      basePath: string;
      httpUrl: string;
      socketPath?: string;
      hostId?: string;
      capabilities: string[];
      manifest: unknown;
    };

    await registry.registerApp({
      slug: body.slug,
      name: body.name,
      version: body.version,
      shape: body.shape,
      basePath: body.basePath,
      httpUrl: body.httpUrl,
      socketPath: body.socketPath,
      hostId: body.hostId ?? HOST_ID,
      capabilities: body.capabilities,
      manifestJson: body.manifest,
    });

    return { ok: true };
  });

  app.get("/registry/apps", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const apps = await registry.listApps();
    return apps.map((a) => ({ slug: a.slug, name: a.name, basePath: a.base_path, status: a.status }));
  });

  app.get("/registry/apps/:slug/endpoint.json", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };
    const row = await registry.getApp(slug);
    if (!row) return reply.code(404).send({ error: "not found" });
    reply.type("application/json");
    return row.manifest_json;
  });

  // --- Provisioning: admin-triggered, creates an app's Postgres schema+role
  app.post("/registry/apps/:slug/provision", async (req, reply) => {
    const ctx = await resolveContext(new Headers(req.headers as any));
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { slug } = req.params as { slug: string };

    const result = await provisionAppDatabase(config.TWODB_PG_ADMIN_URL, slug);
    const encrypted = encryptSecret(result.password, config.AUTH_SECRET);
    await registry.setProvisioning(slug, result.schema, result.role, encrypted);

    // Connection string is returned exactly once — the caller (installer /
    // admin UI) is responsible for writing it into the app's deployment env.
    return { schema: result.schema, role: result.role, connectionString: result.connectionString };
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
    if (!app_) return reply.code(404).send({ error: `app "${slug}" is not registered` });

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

  return app;
}
