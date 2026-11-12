import { z } from "zod";
import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * TwoDrive never talks to better-auth or the workspace tables itself — the
 * Gateway already resolved identity and forwards it as `x-twodb-*` headers
 * (see apps/twodb/src/gateway/proxy.ts). This reads them back out.
 * Copied from apps/tworoute/src/gateway-context.ts (read-side pattern).
 */
export interface ForwardedContext {
  kind: "session" | "apiKey";
  userId: string | null;
  workspaceId: string;
  spaceIds: string[];
}

export function readForwardedContext(req: FastifyRequest): ForwardedContext | null {
  const kind = req.headers["x-twodb-auth-kind"] as string | undefined;
  const workspaceId = req.headers["x-twodb-workspace-id"] as string | undefined;
  if (!kind || !workspaceId) return null;
  const spaceIdsHeader = req.headers["x-twodb-space-ids"] as string | undefined;
  return {
    kind: kind as "session" | "apiKey",
    userId: (req.headers["x-twodb-user-id"] as string | undefined) ?? null,
    workspaceId,
    spaceIds: spaceIdsHeader ? spaceIdsHeader.split(",") : [],
  };
}

/** The calling app's friendly identifier (apps pass it explicitly; the gateway may also inject it). */
export function readAppIdentifier(req: FastifyRequest): string | null {
  const fromHeader = req.headers["x-twodb-app"] as string | undefined;
  return fromHeader?.trim() || null;
}

export function unauthorized(reply: FastifyReply) {
  return reply.code(401).send({ error: "unauthorized" });
}

export function badRequest(reply: FastifyReply, message: string) {
  return reply.code(400).send({ error: message });
}

export function notFound(reply: FastifyReply, message = "not found") {
  return reply.code(404).send({ error: message });
}

/** Maps store errors onto HTTP codes — keeps route handlers terse. */
export function sendStoreError(reply: FastifyReply, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("not found")) return reply.code(404).send({ error: message });
  if (message.includes("already exists") || message.includes("no_default_storage")) return reply.code(409).send({ error: message });
  if (message.includes("invalid path") || message.includes("escapes") || message.includes("required")) {
    return reply.code(400).send({ error: message });
  }
  return reply.code(500).send({ error: message });
}
