// Glue between @twodb/core-async's transport-agnostic relay and the control plane's service tokens.
// Structural types only, so this package needn't depend on core-async.

import { ServiceTokenError, type ServiceTokenClaims } from "@twodb/core-platform/service-token";

export interface ServiceCaller {
  serviceFetch(audience: string, workspaceId: string, path: string, init?: RequestInit & { scopes?: string[]; act?: { type: string; id: string } }): Promise<Response>;
  verifyServiceToken(token: string, opts?: { scope?: string }): Promise<ServiceTokenClaims>;
}

interface OutboundLike {
  app: string;
  type: string;
  workspaceId: string;
  payload: unknown;
  dedupeKey: string;
  act?: { type: string; id: string };
}

/** Every service-to-service message lands on this route of the receiving app. */
export const SERVICE_INBOX_PATH = "/_svc/inbox";

class PermanentError extends Error {
  readonly permanent = true;
}

/** `deliver` for core-async's createRelay: POST the message to the receiver's inbox through the gateway. */
export function serviceDeliver(caller: ServiceCaller): (msg: OutboundLike) => Promise<void> {
  return async (msg) => {
    const res = await caller.serviceFetch(msg.app, msg.workspaceId, SERVICE_INBOX_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: msg.type, payload: msg.payload, dedupeKey: msg.dedupeKey }),
      scopes: [msg.type],
      act: msg.act,
    });
    if (res.ok) return;
    const text = (await res.text().catch(() => "")).slice(0, 300);
    // The message itself is wrong (or unknown to the receiver): retrying cannot help.
    if ([400, 403, 404, 413, 422].includes(res.status)) throw new PermanentError(`${msg.app} rejected ${msg.type}: ${res.status} ${text}`);
    throw new Error(`${msg.app} inbox ${res.status} ${text}`);
  };
}

export interface InboxHandlerOptions {
  caller: ServiceCaller;
  /** relay.receive from core-async. */
  receive(input: { type: string; workspaceId: string; payload: unknown; dedupeKey: string; opts?: { maxAttempts?: number; leaseMs?: number } }): Promise<unknown>;
  /** Message types this app accepts, with the queue options to enqueue them with. Anything else is refused. */
  accepts: Record<string, { maxAttempts?: number; leaseMs?: number }>;
}

/**
 * Framework-agnostic body of `POST /_svc/inbox`. Verifies the service token (signature, audience, expiry and that its
 * scope names this message type), then enqueues locally under the token's workspace — the body's own claims are ignored.
 */
export function createInboxHandler(options: InboxHandlerOptions) {
  return async function handleInbox(headers: { authorization?: string | string[] }, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
    const auth = Array.isArray(headers.authorization) ? headers.authorization[0] : headers.authorization;
    const bearer = auth?.replace(/^Bearer\s+/i, "");
    if (!bearer) return { status: 401, body: { error: "missing service token" } };
    const b = (body ?? {}) as { type?: unknown; payload?: unknown; dedupeKey?: unknown };
    if (typeof b.type !== "string" || typeof b.dedupeKey !== "string" || !b.dedupeKey) return { status: 400, body: { error: "type and dedupeKey are required" } };
    const accepted = options.accepts[b.type];
    if (!accepted) return { status: 404, body: { error: `unknown message type ${b.type}` } };
    let claims: ServiceTokenClaims;
    try {
      claims = await options.caller.verifyServiceToken(bearer, { scope: b.type });
    } catch (err) {
      if (err instanceof ServiceTokenError) return { status: err.message.includes("scoped") ? 403 : 401, body: { error: err.message } };
      throw err;
    }
    await options.receive({ type: b.type, workspaceId: claims.wid, payload: b.payload, dedupeKey: b.dedupeKey, opts: accepted });
    return { status: 202, body: { ok: true } };
  };
}
