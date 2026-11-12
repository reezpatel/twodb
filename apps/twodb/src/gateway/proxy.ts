import type { FastifyRequest, FastifyReply } from "fastify";
import { createDialer, pickTransport } from "@twodb/core-platform/transport";
import type { AuthContext } from "@twodb/core-platform/auth";
import type { RegisteredAppRow } from "../db/sqlite.js";
import { toWebRequest, sendWebResponse } from "./web-request.js";

export const GATEWAY_HOST_ID = process.env.TWODB_HOST_ID ?? "local";

/**
 * Forwards a request to a registered app and streams the response straight
 * back. Injects the Gateway-resolved AuthContext as headers so the app
 * trusts it without talking to better-auth/workspace tables itself — this
 * is the only identity contract downstream apps need to honor.
 */
export async function proxyToApp(
  req: FastifyRequest,
  reply: FastifyReply,
  app: RegisteredAppRow,
  subPath: string,
  ctx: AuthContext | null,
): Promise<void> {
  const target = pickTransport({
    gatewayHostId: GATEWAY_HOST_ID,
    appHostId: app.host_id,
    appHttpUrl: app.http_url,
    appSocketPath: app.socket_path ?? undefined,
  });
  const dialer = createDialer(target);

  const webReq = toWebRequest(req);
  const headers = new Headers(webReq.headers);
  // Never trust identity headers from the caller: always drop them, then (re)set from the resolved context.
  for (const h of [...headers.keys()]) if (h.startsWith("x-twodb-")) headers.delete(h);
  headers.delete("x-gateway-verified");
  // Calling-app identity, as screened by the gateway's onRequest hook
  // (x-twodb-token never reaches here — it is stripped at the edge).
  headers.set("x-gateway-verified", req.callerApp?.verified ? "true" : "false");
  if (req.callerApp?.verified && req.callerApp.slug) headers.set("x-twodb-app", req.callerApp.slug);
  if (ctx) {
    headers.set("x-twodb-auth-kind", ctx.kind);
    if (ctx.userId) headers.set("x-twodb-user-id", ctx.userId);
    headers.set("x-twodb-workspace-id", ctx.workspaceId);
    if (ctx.spaceIds.length) headers.set("x-twodb-space-ids", ctx.spaceIds.join(","));
    if (ctx.apiKeyId) headers.set("x-twodb-api-key-id", ctx.apiKeyId);
  }

  // req.url carries the query string (Fastify's req.url is the full URL), so
  // strip it from the sub-path and append the parsed search exactly once —
  // historically this double-appended ?a=b?a=b for proxied query strings.
  const search = new URL(req.url, "http://internal").search;
  const pathOnly = subPath.split("?")[0];
  const response = await dialer.fetch(pathOnly + search, {
    method: req.method,
    headers,
    body: webReq.body as any,
    duplex: webReq.body ? "half" : undefined,
  } as any);

  await sendWebResponse(reply, response as any);
}
