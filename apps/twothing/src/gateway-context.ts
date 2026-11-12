import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * TwoThing never talks to better-auth or the workspace tables itself — the
 * Gateway already resolved identity and forwards it as `x-twodb-*` headers
 * (see apps/twodb/src/gateway/proxy.ts). Read-side pattern copied from
 * apps/tworoute/src/gateway-context.ts.
 */
export interface ForwardedContext {
  kind: "session" | "apiKey" | "dev";
  userId: string | null;
  workspaceId: string;
}

let devWorkspace: string | undefined;

/** Opt-in dev fallback (TWOTHING_DEV_WORKSPACE) for running without the Gateway. */
export function setDevWorkspace(ws: string | undefined) {
  devWorkspace = ws;
}

export function readForwardedContext(req: FastifyRequest): ForwardedContext | null {
  const kind = req.headers["x-twodb-auth-kind"] as string | undefined;
  const workspaceId = req.headers["x-twodb-workspace-id"] as string | undefined;
  if (kind && workspaceId) {
    return {
      kind: kind as "session" | "apiKey",
      userId: (req.headers["x-twodb-user-id"] as string | undefined) ?? null,
      workspaceId,
    };
  }
  if (devWorkspace) return { kind: "dev", userId: "dev-user", workspaceId: devWorkspace };
  return null;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: unknown,
  ) {
    super(code);
  }
}

export function sendError(reply: FastifyReply, err: unknown) {
  if (err instanceof HttpError) {
    return reply.code(err.status).send({ error: err.code, ...(err.detail !== undefined ? { detail: err.detail } : {}) });
  }
  if (err && typeof err === "object" && "issues" in err) {
    return reply.code(400).send({ error: "invalid_request", detail: (err as { issues: unknown }).issues });
  }
  throw err;
}
