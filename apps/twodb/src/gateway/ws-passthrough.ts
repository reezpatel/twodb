import type { FastifyInstance } from "fastify";
import type { FastifyRequest } from "fastify";
import * as net from "node:net";
import type { RegisteredAppRow } from "../db/sqlite.js";
import { pickTransport, createDialer } from "@twodb/core-platform/transport";
import { GATEWAY_HOST_ID } from "./proxy.js";


/**
 * WebSocket passthrough: bridges `GET /apps/:slug/*` upgrade requests to
 * the registered app's own WS endpoint, byte-for-byte in both directions.
 *
 * Auth model: the upgrade runs through the same resolveContext as HTTP
 * traffic, so session/API-key callers are authenticated before the bridge
 * opens — with ONE carve-out. Dispatch's runner socket authenticates with a
 * *runner key* (query param), which dispatch owns end-to-end; for those
 * upgrades only, we forward unauthenticated (dispatch closes with 4401 on
 * a bad key). Every other upgrade requires a resolved context.
 *
 * Why raw net sockets: undici's fetch (the HTTP proxy path) can't upgrade,
 * so we dial the app with a plain TCP/unix connection, send a hand-built
 * HTTP/1.1 upgrade request with the forwarded identity headers, and pipe
 * the socket into the ws server pair.
 */

const RUNNER_KEY_UPGRADE = /^\/apps\/dispatch\/runner-ws/;

interface PipedUpgrade {
  reqPath: string;
  headers: Record<string, string>;
}

function headerValues(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v.join(",");
  return v;
}

export function registerWsPassthrough(app: FastifyInstance, getApp: (slug: string) => Promise<RegisteredAppRow | undefined>): void {
  app.server.on("upgrade", async (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://internal");
    const m = url.pathname.match(/^\/apps\/([^/]+)\/(.*)$/);
    if (!m) return; // not an app path — Fastify/other handlers own it
    const [, slug, rest] = m;
    const row = await getApp(slug).catch(() => undefined);
    if (!row) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    // Only bridged for apps that actually registered WS-capable paths
    // (dispatch for now). Keeps the passthrough deny-by-default.
    if (slug !== "dispatch") {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    const target = pickTransport({
      gatewayHostId: GATEWAY_HOST_ID,
      appHostId: row.host_id,
      appHttpUrl: row.http_url,
      appSocketPath: row.socket_path ?? undefined,
    });

    // Build the forwarded upgrade request: path + query preserved, identity
    // headers resolved exactly like the HTTP proxy would.
    const fwdHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      const val = headerValues(v);
      if (val) fwdHeaders[k] = val;
    }

    const isRunnerUpgrade = RUNNER_KEY_UPGRADE.test(url.pathname);
    if (!isRunnerUpgrade) {
      // Caller-side upgrades carry the workspace identity — resolve here and
      // pin x-twodb-workspace-id so dispatch can trust it (it can't call
      // better-auth itself). Runner upgrades authenticate inside dispatch.
      const { __resolveContext } = app as unknown as {
        __resolveContext: (h: Headers, a?: string | null, b?: string | null) => Promise<import("@twodb/core-platform/auth").AuthContext | null>;
      };
      const ctx = await __resolveContext(
        new Headers(req.headers as Record<string, string>),
        headerValues(req.headers["x-twodb-workspace-id"]) ?? null,
        headerValues(req.headers["x-twodb-space-ids"]) ?? null,
      ).catch(() => null);
      if (!ctx) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      fwdHeaders["x-twodb-auth-kind"] = ctx.kind;
      if (ctx.userId) fwdHeaders["x-twodb-user-id"] = ctx.userId;
      fwdHeaders["x-twodb-workspace-id"] = ctx.workspaceId;
      if (ctx.spaceIds.length) fwdHeaders["x-twodb-space-ids"] = ctx.spaceIds.join(",");
      if (ctx.apiKeyId) fwdHeaders["x-twodb-api-key-id"] = ctx.apiKeyId;
    }

    // Dial the app and replay the upgrade request.
    const out =
      target.kind === "unix"
        ? net.connect({ path: target.socketPath })
        : net.connect({ port: Number(new URL(target.baseUrl).port || 80), host: new URL(target.baseUrl).hostname });

    let settled = false;
    out.on("connect", () => {
      // Sub-path relative to the app's base path (matches proxyToApp's
      // behavior — dispatch registers its routes without the /apps/:slug
      // prefix).
      const subPath = url.pathname.replace(/^\/apps\/[^/]+/, "") || "/";
      const reqLine = `GET ${subPath}${url.search} HTTP/1.1\r\n`;
      const headerLines = Object.entries(fwdHeaders)
        .map(([k, v]) => `${k}: ${v}\r\n`)
        .join("");
      out.write(reqLine + headerLines + "\r\n");
      if (head.length) out.write(head);
    });
    out.on("error", () => {
      if (!settled) {
        socket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
        socket.destroy();
      }
      settled = true;
    });

    // Wait for the app's 101, then splice.
    let buf = Buffer.alloc(0);
    out.on("data", (chunk: Buffer) => {
      if (settled) return;
      buf = Buffer.concat([buf, chunk]);
      const idx = buf.indexOf("\r\n\r\n");
      if (idx === -1) return;
      const headStr = buf.subarray(0, idx).toString();
      if (!/^HTTP\/1\.1 101/.test(headStr)) {
        socket.write(buf.subarray(0, idx + 4));
        socket.end();
        out.destroy();
        settled = true;
        return;
      }
      settled = true;
      // Relay the app's 101 head verbatim — the Sec-WebSocket-Accept header
      // the client validates was computed by the app against the client's
      // Sec-WebSocket-Key, which we forwarded unchanged.
      socket.write(buf.subarray(0, idx + 4));
      const rest = buf.subarray(idx + 4);
      if (rest.length) socket.write(rest);
      socket.pipe(out);
      out.pipe(socket);
    });
    socket.on("error", () => {
      out.destroy();
    });
    socket.on("close", () => {
      out.destroy();
    });
  });
}
