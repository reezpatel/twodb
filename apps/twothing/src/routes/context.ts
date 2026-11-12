import type { FastifyReply, FastifyRequest } from "fastify";
import type { Kysely } from "@twodb/core-data/db";
import type { TwoThingDb } from "../db/schema.js";
import { readForwardedContext, sendError, type ForwardedContext } from "../gateway-context.js";

export interface Ctx {
  db: Kysely<TwoThingDb>;
}

/** Wraps a handler with gateway-identity resolution + uniform error mapping. */
export type Req<P, Q> = Omit<FastifyRequest, "params" | "query" | "body"> & { params: P; query: Q; body: unknown };

export function authed<P = Record<string, string>, Q = Record<string, string | undefined>>(
  fn: (auth: ForwardedContext, req: Req<P, Q>, reply: FastifyReply) => Promise<unknown>,
) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = readForwardedContext(req);
    if (!auth) return reply.code(401).send({ error: "unauthorized" });
    try {
      return await fn(auth, req as unknown as Req<P, Q>, reply);
    } catch (err) {
      return sendError(reply, err);
    }
  };
}

export const flag = (v: string | undefined) => v === "1" || v === "true";
