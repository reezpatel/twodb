import type { FastifyRequest } from "fastify";

/**
 * Identity is resolved by the Gateway and forwarded as `x-twodb-*` headers.
 * Garden never talks to better-auth itself. The active space is chosen by the
 * client (`x-garden-space` header) and must be one of the caller's spaces.
 */
export interface ForwardedContext {
  kind: "session" | "apiKey";
  userId: string | null;
  apiKeyId: string | null;
  workspaceId: string;
  spaceIds: string[];
  /** Stable actor id recorded on writes: `user:<id>` or `agent:<apiKeyId>`. */
  actor: string;
}

export interface Scope {
  workspaceId: string;
  spaceId: string;
  actor: string;
  userId: string | null;
}

export const SPACE_HEADER = "x-garden-space";

export function readForwardedContext(req: Pick<FastifyRequest, "headers">): ForwardedContext | null {
  const kind = req.headers["x-twodb-auth-kind"] as string | undefined;
  const workspaceId = req.headers["x-twodb-workspace-id"] as string | undefined;
  if (!kind || !workspaceId) return null;
  const spaceIds = (req.headers["x-twodb-space-ids"] as string | undefined)?.split(",").filter(Boolean) ?? [];
  const userId = (req.headers["x-twodb-user-id"] as string | undefined) ?? null;
  const apiKeyId = (req.headers["x-twodb-api-key-id"] as string | undefined) ?? null;
  const k = kind === "apiKey" ? "apiKey" : "session";
  const actor = k === "apiKey" ? `agent:${apiKeyId ?? userId ?? "unknown"}` : `user:${userId ?? "unknown"}`;
  return { kind: k, userId, apiKeyId, workspaceId, spaceIds, actor };
}

/** Picks the active space: the requested one if the caller may use it, else their first, else "default". */
export function resolveSpace(ctx: ForwardedContext, requested: string | undefined): string | null {
  const want = requested?.trim();
  if (ctx.spaceIds.length === 0) return want || "default";
  if (!want) return ctx.spaceIds[0];
  return ctx.spaceIds.includes(want) ? want : null;
}
