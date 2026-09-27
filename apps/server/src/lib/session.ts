import type { Context } from "hono";
import { auth } from "../auth";
import { resolveApiKey } from "./api-keys";

/**
 * Authenticates a request either via the better-auth cookie session (with an
 * active organization) or an org API key in the `x-api-key` header. Consumers
 * only rely on `organizationId`; `session` is null for key-authenticated calls.
 */
export async function requireOrgSession(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (session) {
    const organizationId = session.session.activeOrganizationId;
    if (organizationId) return { session, organizationId };
  }

  const apiKey = c.req.header("x-api-key");
  if (apiKey) {
    const resolved = await resolveApiKey(apiKey);
    if (resolved) return { session: null, organizationId: resolved.organizationId };
  }

  return null;
}
