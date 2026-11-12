import type { FastifyRequest } from "fastify";

/**
 * Identity is resolved by the Gateway and forwarded as `x-twodb-*` headers
 * (also on WebSocket upgrades). Paintress never talks to better-auth itself.
 */
export interface ForwardedContext {
  kind: "session" | "apiKey";
  userId: string | null;
  apiKeyId: string | null;
  workspaceId: string;
  spaceIds: string[];
  /** Stable actor id recorded on every change: `user:<id>` or `agent:<apiKeyId>`. */
  actor: string;
}

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
