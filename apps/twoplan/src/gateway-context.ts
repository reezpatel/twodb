import type { FastifyRequest } from "fastify";

/**
 * Identity is resolved by the Gateway and forwarded as `x-twodb-*` headers.
 * TwoPlan access is workspace-level: every member of the workspace sees every
 * space and project in it (there are no per-project roles).
 */
export interface ForwardedContext {
  kind: "session" | "apiKey";
  userId: string | null;
  workspaceId: string;
}

export function readForwardedContext(req: FastifyRequest): ForwardedContext | null {
  const kind = req.headers["x-twodb-auth-kind"] as string | undefined;
  const workspaceId = req.headers["x-twodb-workspace-id"] as string | undefined;
  if (!kind || !workspaceId) return null;
  return {
    kind: kind as "session" | "apiKey",
    userId: (req.headers["x-twodb-user-id"] as string | undefined) ?? null,
    workspaceId,
  };
}
