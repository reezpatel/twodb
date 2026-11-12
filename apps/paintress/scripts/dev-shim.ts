#!/usr/bin/env tsx
/**
 * Standalone UI dev without the control plane. Stands in for the Gateway for
 * the webapp's vite proxy: fakes the session + spaces endpoints and forwards
 * /apps/paintress/* (HTTP and WebSocket) to a local Paintress with forged
 * x-twodb-* identity headers.  DEV ONLY — it grants anyone who can reach it
 * access to workspace "dev-ws", so it binds to localhost.
 *
 *   tsx scripts/dev-shim.ts            # listens on :6499, targets :6414
 *   TWODB_GATEWAY_URL=http://localhost:6499 pnpm --filter @twodb/app-paintress-webapp dev
 */
import * as http from "node:http";
import * as net from "node:net";

const PORT = Number(process.env.SHIM_PORT ?? 6499);
const TARGET = Number(process.env.PAINTRESS_PORT ?? 6414);
const IDENTITY: Record<string, string> = {
  "x-twodb-auth-kind": process.env.SHIM_KIND ?? "session",
  "x-twodb-user-id": "dev-user",
  "x-twodb-workspace-id": "dev-ws",
  "x-twodb-space-ids": "dev-space",
};

const json = (res: http.ServerResponse, body: unknown) => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(body));

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";
  if (url.startsWith("/api/auth/get-session")) return json(res, { session: { id: "dev" }, user: { id: "dev-user", name: "Dev" } });
  if (url.startsWith("/registry/spaces")) return json(res, { spaces: [{ id: "dev-space", name: "Dev space" }] });
  const m = url.match(/^\/apps\/paintress(\/.*)?$/);
  if (!m) return void res.writeHead(404).end();
  const upstream = http.request(
    { host: "127.0.0.1", port: TARGET, path: m[1] || "/", method: req.method, headers: { ...req.headers, ...IDENTITY, host: `127.0.0.1:${TARGET}` } },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => res.writeHead(502).end());
  req.pipe(upstream);
});

server.on("upgrade", (req, socket, head) => {
  const m = (req.url ?? "").match(/^\/apps\/paintress(\/.*)$/);
  if (!m) return void socket.destroy();
  const out = net.connect(TARGET, "127.0.0.1", () => {
    const headers = { ...req.headers, ...IDENTITY, host: `127.0.0.1:${TARGET}` };
    out.write(`GET ${m[1]} HTTP/1.1\r\n${Object.entries(headers).map(([k, v]) => `${k}: ${v}\r\n`).join("")}\r\n`);
    if (head.length) out.write(head);
    socket.pipe(out);
    out.pipe(socket);
  });
  out.on("error", () => socket.destroy());
  socket.on("error", () => out.destroy());
});

server.listen(PORT, "127.0.0.1", () => console.log(`dev shim on http://127.0.0.1:${PORT} → paintress :${TARGET}`));
