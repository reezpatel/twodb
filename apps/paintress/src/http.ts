import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodType, z } from "zod";
import { HttpError } from "./store.js";
import { readForwardedContext, type ForwardedContext } from "./gateway-context.js";

export function requireCtx(req: FastifyRequest): ForwardedContext {
  const ctx = readForwardedContext(req);
  if (!ctx) throw new HttpError(401, "unauthorized");
  return ctx;
}

/** Validates params + query + body together (matches how the manifest documents requests). */
export function parseRequest<T extends ZodType>(schema: T, req: FastifyRequest): z.infer<typeof schema> {
  const body = req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body) ? (req.body as object) : {};
  const input = { ...(req.query as object), ...body, ...(req.params as object) };
  const r = schema.safeParse(input);
  if (!r.success) {
    const message = r.error.issues.map((i) => `${i.path.join(".") || "(request)"}: ${i.message}`).join("; ");
    throw new HttpError(400, "invalid_request", message);
  }
  return r.data;
}

export function sendError(err: unknown, reply: FastifyReply, log: { error: (o: unknown, m?: string) => void }) {
  if (err instanceof HttpError) return reply.code(err.status).send({ error: err.code, message: err.message });
  const e = err as { statusCode?: number; message?: string; validation?: unknown };
  if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).send({ error: "bad_request", message: e.message });
  log.error({ err }, "unhandled error");
  return reply.code(500).send({ error: "internal_error" });
}
