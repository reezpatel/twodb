import type { FastifyRequest } from "fastify";

/**
 * TwoChat never talks to better-auth or the workspace tables itself — the
 * Gateway already resolved identity and forwards it as `x-twodb-*` headers
 * (see apps/twodb/src/gateway/proxy.ts). This just reads them back out.
 * Same read-side pattern as apps/tworoute/src/gateway-context.ts.
 */
export interface ForwardedContext {
  kind: "session" | "apiKey";
  userId: string | null;
  workspaceId: string;
  spaceIds: string[];
  apiKeyId: string | null;
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
    apiKeyId: (req.headers["x-twodb-api-key-id"] as string | undefined) ?? null,
  };
}

/**
 * Participant identity for messages/notifications. User sessions carry a real
 * userId; workspace API keys act as a bot when the key id maps to a
 * registered bot (see the bot posting endpoint) — otherwise they're an
 * anonymous agent actor identified by the key id.
 */
export function actorFor(ctx: ForwardedContext): { type: "user" | "bot"; userId: string | null; botKey: string | null } {
  if (ctx.kind === "session") return { type: "user", userId: ctx.userId, botKey: null };
  return { type: "bot", userId: null, botKey: ctx.apiKeyId };
}
