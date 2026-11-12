import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodType, z } from "zod";
import { readForwardedContext, resolveSpace, SPACE_HEADER, type Scope } from "./gateway-context.js";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const notFound = (what = "record") => new HttpError(404, `${what}_not_found`);
export const badRequest = (code: string, message?: string) => new HttpError(400, code, message);

/** Resolves workspace + active space for the request (401 without gateway identity, 403 for a foreign space). */
export function requireScope(req: FastifyRequest): Scope {
  const ctx = readForwardedContext(req);
  if (!ctx) throw new HttpError(401, "unauthorized");
  const header = req.headers[SPACE_HEADER] as string | undefined;
  const query = (req.query as Record<string, unknown> | undefined)?.spaceId;
  const spaceId = resolveSpace(ctx, header ?? (typeof query === "string" ? query : undefined));
  if (!spaceId) throw new HttpError(403, "space_forbidden");
  return { workspaceId: ctx.workspaceId, spaceId, actor: ctx.actor, userId: ctx.userId };
}

/** Validates params + query + body together (matches how the manifest documents requests). */
export function parseRequest<T extends ZodType>(schema: T, req: FastifyRequest): z.infer<T> {
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
  const e = err as { statusCode?: number; message?: string };
  if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).send({ error: "bad_request", message: e.message });
  log.error({ err }, "unhandled error");
  return reply.code(500).send({ error: "internal_error" });
}
