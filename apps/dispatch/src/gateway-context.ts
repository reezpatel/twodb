import type { FastifyRequest } from "fastify";

/**
 * Dispatch never talks to better-auth or the workspace tables itself — the
 * Gateway already resolved identity and forwards it as `x-twodb-*` headers
 * (same pattern as apps/tworoute/src/gateway-context.ts).
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
