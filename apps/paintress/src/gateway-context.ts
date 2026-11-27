import type { FastifyRequest } from "fastify";

/**
 * Identity is resolved by the Gateway and forwarded as `x-twodb-*` headers
 * (also on WebSocket upgrades). Paintress never talks to better-auth itself.
 *
 * kind "service" = an app-to-app call carrying a gateway ACT token (the
 * calling app is named in x-twodb-service-app). Artisan's canvas tools
 * (update_canvas) reach Paintress this way.
 */
export interface ForwardedContext {
  kind: "session" | "apiKey" | "service";
  userId: string | null;
  apiKeyId: string | null;
  workspaceId: string;
  spaceIds: string[];
  /** Stable actor id recorded on every change: `user:<id>`, `agent:<apiKeyId>` or `service:<app>`. */
  actor: string;
}

export function readForwardedContext(req: Pick<FastifyRequest, "headers">): ForwardedContext | null {
  const kind = req.headers["x-twodb-auth-kind"] as string | undefined;
  const workspaceId = req.headers["x-twodb-workspace-id"] as string | undefined;
  if (!kind || !workspaceId) return null;
  const spaceIds = (req.headers["x-twodb-space-ids"] as string | undefined)?.split(",").filter(Boolean) ?? [];
  const userId = (req.headers["x-twodb-user-id"] as string | undefined) ?? null;
  const apiKeyId = (req.headers["x-twodb-api-key-id"] as string | undefined) ?? null;
  if (kind === "service") {
    const serviceApp = (req.headers["x-twodb-service-app"] as string | undefined) ?? null;
    return { kind: "service", userId, apiKeyId, workspaceId, spaceIds, actor: `service:${serviceApp ?? "unknown"}` };
  }
  const k = kind === "apiKey" ? "apiKey" : "session";
  const actor = k === "apiKey" ? `agent:${apiKeyId ?? userId ?? "unknown"}` : `user:${userId ?? "unknown"}`;
  return { kind: k, userId, apiKeyId, workspaceId, spaceIds, actor };
}

