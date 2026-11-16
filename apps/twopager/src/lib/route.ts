import type { FastifyInstance } from "fastify";
import type { ZodType, z } from "zod";
import { defineEndpoint, type EndpointSpec, type HttpMethod, type AuthRequirement } from "@twodb/core-platform/manifest";
import { readForwardedContext } from "../gateway-context.js";
import type { Db } from "../db/schema.js";
import type { Blobs } from "./blobs.js";
import type { SiteResolver } from "../engine/resolver.js";
import type { TwoPagerConfig } from "../config.js";
import { HttpError, forbidden } from "./http.js";

export interface Deps {
  db: Db;
  blobs: Blobs;
  resolver: SiteResolver;
  config: TwoPagerConfig;
}

export interface Ctx extends Deps {
  workspaceId: string;
  /** null for api-key calls without a user. */
  userId: string | null;
  spaceIds: string[];
}

export interface RouteDef {
  spec: EndpointSpec;
  handler: (ctx: Ctx, input: any, raw?: Buffer) => Promise<unknown>;
}

interface RouteOpts<S extends ZodType> {
  name: string;
  method: HttpMethod;
  path: string;
  description: string;
  auth?: AuthRequirement;
  request?: S;
  response?: ZodType;
  handler: (ctx: Ctx, input: z.infer<S>, raw?: Buffer) => Promise<unknown>;
}

/** One definition drives both the manifest (docs/CLI) and the Fastify route. */
export function route<S extends ZodType>(o: RouteOpts<S>): RouteDef {
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

/** Callers restricted to some spaces (x-twodb-space-ids) may only touch those. */
export function assertSpaceAccess(ctx: Ctx, spaceId: string) {
  if (ctx.spaceIds.length && !ctx.spaceIds.includes(spaceId)) throw forbidden("no access to this space");
}

export function registerRoutes(app: FastifyInstance, deps: Deps, routes: RouteDef[]) {
  for (const r of routes) {
    app.route({
      method: r.spec.method,
      url: r.spec.path,
      handler: async (req, reply) => {
        try {
          const fwd = readForwardedContext(req);
          if (!fwd) return reply.code(401).send({ error: "unauthorized" });
          const ctx: Ctx = { ...deps, workspaceId: fwd.workspaceId, userId: fwd.userId, spaceIds: fwd.spaceIds };
          const raw = Buffer.isBuffer(req.body) ? req.body : undefined;
          const merged = {
            ...((req.query as object) ?? {}),
            ...(!raw && req.body && typeof req.body === "object" ? (req.body as object) : {}),
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
          const result = await r.handler(ctx, input, raw);
          return reply.send(result ?? { ok: true });
        } catch (err) {
          if (err instanceof HttpError) return reply.code(err.status).send({ error: err.code, message: err.message });
          const pg = err as { code?: string };
          if (pg.code === "23505") return reply.code(409).send({ error: "conflict", message: "Already exists" });
          if (pg.code === "23514") return reply.code(400).send({ error: "bad_request", message: "A value violates a constraint" });
          req.log.error({ err }, "unhandled route error");
          return reply.code(500).send({ error: "internal_error" });
        }
      },
    });
  }
}
