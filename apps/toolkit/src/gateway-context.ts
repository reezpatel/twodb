import type { FastifyRequest } from "fastify";

/**
 * Toolkit never talks to better-auth or the workspace tables itself — the
 * Gateway already resolved identity and forwards it as `x-twodb-*` headers.
 *
 * kind "service" = an app-to-app call carrying a gateway ACT token (the
 * gateway verifies the signature + act grant before forwarding, and names the
 * calling app in x-twodb-service-app). Artisan's toolkit meta-tools
 * (list_tools/call_tool) authenticate this way, so the agent's tools resolve
 * here — treat it as trusted for the workspace in the token.
 */
export interface ForwardedContext {
  kind: "session" | "apiKey" | "service";
  userId: string | null;
  workspaceId: string;
  spaceIds: string[];
  /** The calling app, when kind === "service" (e.g. "artisan"). */
  serviceApp: string | null;
}

export function readForwardedContext(req: FastifyRequest): ForwardedContext | null {
  const kind = req.headers["x-twodb-auth-kind"] as string | undefined;
  const workspaceId = req.headers["x-twodb-workspace-id"] as string | undefined;
  if (!kind || !workspaceId) return null;
  const spaceIdsHeader = req.headers["x-twodb-space-ids"] as string | undefined;
  return {
    kind: kind as ForwardedContext["kind"],
    userId: (req.headers["x-twodb-user-id"] as string | undefined) ?? null,
    workspaceId,
    spaceIds: spaceIdsHeader ? spaceIdsHeader.split(",") : [],
    serviceApp: (req.headers["x-twodb-service-app"] as string | undefined) ?? null,
  };
}

