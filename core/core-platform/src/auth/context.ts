import type { AuthEngine } from "./engine.js";
import type { WorkspacePlatformRepo } from "./repository.js";

export interface AuthContext {
  kind: "session" | "apiKey";
  userId: string | null;
  workspaceId: string;
  /** Only present for session auth — the user-selected active spaces. Empty = all spaces. */
  spaceIds: string[];
  apiKeyId?: string;
  scopes?: string[];
}

export interface ResolveAuthContextOptions {
  authEngine: AuthEngine;
  workspacePlatform: WorkspacePlatformRepo;
  headers: Headers;
  /** Workspace the caller wants to act as, from `x-twodb-workspace-id` (sessions can belong to many). */
  requestedWorkspaceId?: string | null;
  /** Comma-separated space ids from `x-twodb-space-ids`, session auth only. */
  requestedSpaceIds?: string | null;
}

/**
 * Single entry point the Gateway (and any app that wants to verify a
 * forwarded identity) uses to turn a request's headers into a normalized
 * `AuthContext` — resolving either a better-auth session/bearer token or a
 * workspace-scoped API key. Returns null if unauthenticated.
 */
export async function resolveAuthContext(options: ResolveAuthContextOptions): Promise<AuthContext | null> {
  const apiKeyHeader = options.headers.get("x-api-key");
  if (apiKeyHeader) {
    const result = await options.workspacePlatform.verifyApiKey(apiKeyHeader);
    if (!result) return null;
    return {
      kind: "apiKey",
      userId: null,
      workspaceId: result.workspaceId,
      spaceIds: [],
      apiKeyId: result.apiKeyId,
      scopes: result.scopes,
    };
  }

  const session = await options.authEngine.api.getSession({ headers: options.headers });
  if (!session?.user) return null;

  const workspaceId =
    options.requestedWorkspaceId ??
    (await options.workspacePlatform.listWorkspacesForUser(session.user.id))[0]?.id;
  if (!workspaceId) return null;

  const membership = await options.workspacePlatform.isWorkspaceMember(workspaceId, session.user.id);
  if (!membership) return null;

  const spaceIds = options.requestedSpaceIds
    ? options.requestedSpaceIds.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    kind: "session",
    userId: session.user.id,
    workspaceId,
    spaceIds,
  };
}
