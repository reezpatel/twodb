import type { FastifyRequest } from "fastify";

/** Identity is resolved by the Gateway and forwarded as `x-twodb-*` headers. */
export interface ForwardedContext {
  kind: "session" | "apiKey";
  userId: string | null;
  workspaceId: string;
  /** Spaces the caller may access; empty = unrestricted (e.g. workspace-wide API key). */
  spaceIds: string[];
}

export function readForwardedContext(req: FastifyRequest): ForwardedContext | null {
  const kind = req.headers["x-twodb-auth-kind"] as string | undefined;
  const workspaceId = req.headers["x-twodb-workspace-id"] as string | undefined;
  if (!kind || !workspaceId) return null;
  const spaces = (req.headers["x-twodb-space-ids"] as string | undefined) ?? "";
  return {
    kind: kind as "session" | "apiKey",
    userId: (req.headers["x-twodb-user-id"] as string | undefined) ?? null,
    workspaceId,
    spaceIds: spaces.split(",").map((s) => s.trim()).filter(Boolean),
  };
}
