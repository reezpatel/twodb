import type { FastifyInstance } from "fastify";
import { z, type ZodType } from "zod";
import { defineEndpoint, type EndpointSpec, type HttpMethod, type AuthRequirement } from "@twodb/core-platform/manifest";
import type { StorageAdapter } from "@twodb/core-data/storage";
import { readForwardedContext } from "../gateway-context.js";
import type { Db } from "../db/schema.js";
import { HttpError } from "./http.js";

export interface Ctx {
  db: Db;
  storage: StorageAdapter;
  workspaceId: string;
  /** null for api-key calls without a user. */
  userId: string | null;
}

export interface RouteDef {
  spec: EndpointSpec;
  handler: (ctx: Ctx, input: any) => Promise<unknown>;
  /** Raw handler escape hatch (uploads/downloads); receives the Fastify req/reply. */
  raw?: (ctx: Ctx, req: any, reply: any) => Promise<unknown>;
}

interface RouteOpts<S extends ZodType> {
  name: string;
  method: HttpMethod;
  path: string;
  description: string;
  auth?: AuthRequirement;
  request?: S;
  response?: ZodType;
  handler: (ctx: Ctx, input: z.infer<S>) => Promise<unknown>;
}

/** One definition drives both the manifest (docs/CLI) and the Fastify route. */
export function route<S extends ZodType = ZodType>(o: RouteOpts<S>): RouteDef {
  return {
    spec: defineEndpoint({
      name: o.name,
      method: o.method,
      path: o.path,
      auth: o.auth ?? "session-or-apiKey",
      description: o.description,
      request: o.request,
      response: o.response,
    }),
    handler: o.handler as any,
  };
}

/** Binary endpoint (upload/download): handler drives the reply itself. */
export function rawRoute(o: Omit<RouteOpts<ZodType>, "handler" | "request"> & { raw: NonNullable<RouteDef["raw"]> }): RouteDef {
  return {
    spec: defineEndpoint({ name: o.name, method: o.method, path: o.path, auth: o.auth ?? "session-or-apiKey", description: o.description, response: o.response }),
    handler: async () => undefined,
    raw: o.raw,
  };
}

export function registerRoutes(app: FastifyInstance, base: Omit<Ctx, "workspaceId" | "userId">, routes: RouteDef[]) {
  for (const r of routes) {
    app.route({
      method: r.spec.method,
      url: r.spec.path,
      handler: async (req, reply) => {
        try {
          let ctx: Ctx;
          if (r.spec.auth === "public") {
            ctx = { ...base, workspaceId: "", userId: null };
          } else {
            const fwd = readForwardedContext(req);
            if (!fwd) return reply.code(401).send({ error: "unauthorized" });
            ctx = { ...base, workspaceId: fwd.workspaceId, userId: fwd.userId };
          }
          if (r.raw) return await r.raw(ctx, req, reply);
          const merged = {
            ...((req.query as object) ?? {}),
            ...(req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) ? (req.body as object) : {}),
            ...((req.params as object) ?? {}),
          };
          let input: unknown = merged;
          if (r.spec.request) {
            const parsed = r.spec.request.safeParse(merged);
            if (!parsed.success) {
              return reply.code(400).send({
                error: "invalid_request",
                issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
              });
            }
            input = parsed.data;
          }
          const result = await r.handler(ctx, input);
          return reply.send(result ?? { ok: true });
        } catch (err) {
          if (err instanceof HttpError) return reply.code(err.status).send({ error: err.code, message: err.message });
          const pg = err as { code?: string; detail?: string };
          if (pg.code === "23503") return reply.code(409).send({ error: "in_use", message: "Still referenced by other records (e.g. a status that has tickets). Move or delete those first." });
          if (pg.code === "23505") return reply.code(409).send({ error: "conflict", message: "Already exists" });
          if (pg.code === "23514") return reply.code(400).send({ error: "bad_request", message: "A value violates a constraint" });
          req.log.error({ err }, "unhandled route error");
          return reply.code(500).send({ error: "internal_error" });
        }
      },
    });
  }
}
