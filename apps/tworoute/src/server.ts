import Fastify from "fastify";
import { createPgDb } from "@twodb/core-data/db";
import {
  INTERNAL_MANIFEST_PATH,
  REGISTRATION_TOKEN_HEADER,
  handleManifestRequest,
} from "@twodb/core-platform/manifest";
import { tworouteManifest } from "./manifest.js";
import type { TwoRouteConfig } from "./config.js";
import { applySchema, type TwoRouteDb } from "./db/schema.js";
import { createConnectionsRepo } from "./db/repository.js";
import { getProvider } from "./providers/index.js";
import { readForwardedContext } from "./gateway-context.js";

export async function buildServer(config: TwoRouteConfig) {
  const app = Fastify({ logger: true });
  const db = createPgDb<TwoRouteDb>({ connectionString: config.DATABASE_URL, schema: "tworoute" });
  await applySchema(db);
  const connections = createConnectionsRepo(db);

  app.post("/connections", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const body = req.body as {
      spaceId: string;
      name: string;
      provider: string;
      baseUrl: string;
      apiKey: string;
      defaultModel?: string;
    };
    const row = await connections.create({
      workspaceId: ctx.workspaceId,
      spaceId: body.spaceId,
      name: body.name,
      provider: body.provider,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      defaultModel: body.defaultModel,
    });
    return { id: row.id };
  });

  app.get("/connections", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const rows = await connections.listForSpaces(ctx.spaceIds.length ? ctx.spaceIds : [ctx.workspaceId]);
    return rows.map((r) => ({ id: r.id, name: r.name, provider: r.provider, default_model: r.default_model }));
  });

  app.post("/completions", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });

    const body = req.body as {
      connectionId?: string;
      model: string;
      messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
      stream?: boolean;
      temperature?: number;
      max_tokens?: number;
    };

    const connection = body.connectionId
      ? await connections.get(body.connectionId)
      : (await connections.listForSpaces(ctx.spaceIds.length ? ctx.spaceIds : [ctx.workspaceId]))[0];

    if (!connection) return reply.code(404).send({ error: "no LLM connection available for this space" });

    const provider = getProvider(connection.provider);
    const upstream = await provider.streamCompletion(connection, body);

    reply.raw.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      reply.raw.setHeader(key, value);
    });

    if (!upstream.body) {
      reply.raw.end();
      return;
    }
    reply.hijack();
    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply.raw.write(value);
      }
    } finally {
      reply.raw.end();
    }
  });

  // Pull-registration endpoint: TwoDB's orchestrator polls this on the
  // container's published port and completes registration itself (see
  // core-platform/src/manifest/serve.ts for why both push and pull exist).
  app.get(INTERNAL_MANIFEST_PATH, async (req, reply) => {
    const res = handleManifestRequest(
      tworouteManifest,
      { registrationToken: config.TWODB_PROVISION_TOKEN, httpUrl: config.HTTP_URL },
      req.headers[REGISTRATION_TOKEN_HEADER],
    );
    return reply.code(res.status).send(res.body);
  });

  app.get("/healthz", async () => ({ ok: true }));

  return app;
}
