#!/usr/bin/env tsx
/**
 * Standalone UI dev without the control plane. Stands in for the Gateway for
 * the webapp's vite proxy: fakes the session/spaces/members endpoints and
 * forwards /apps/garden/* to a local Garden with forged x-twodb-* identity.
 * DEV ONLY — it grants anyone who can reach it access to workspace "dev-ws",
 * so it binds to localhost.
 *
 *   GARDEN_SKIP_REGISTER=1 pnpm --filter @twodb/app-garden dev
 *   pnpm --filter @twodb/app-garden dev:shim            # :6498 → :6410
 *   TWODB_GATEWAY_URL=http://localhost:6498 pnpm --filter @twodb/app-garden-webapp dev
 */
import * as http from "node:http";

const PORT = Number(process.env.SHIM_PORT ?? 6498);
const TARGET = Number(process.env.GARDEN_PORT ?? 6410);
const IDENTITY: Record<string, string> = {
  "x-twodb-auth-kind": "session",
  "x-twodb-user-id": "dev-user",
  "x-twodb-workspace-id": "dev-ws",
  "x-twodb-space-ids": "dev-space,dev-space-2",
};

const json = (res: http.ServerResponse, body: unknown) => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(body));

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";
  if (url.startsWith("/api/auth/get-session")) return json(res, { session: { id: "dev" }, user: { id: "dev-user", name: "Dev User", email: "dev@example.com" } });
  if (url.startsWith("/registry/spaces"))
    return json(res, { spaces: [{ id: "dev-space", name: "Personal" }, { id: "dev-space-2", name: "Team" }] });
  if (url.startsWith("/registry/members"))
    return json(res, {
      me: "dev-user",
      members: [
        { id: "dev-user", name: "Dev User", email: "dev@example.com", image: null, role: "owner" },
        { id: "ada", name: "Ada Lovelace", email: "ada@example.com", image: null, role: "member" },
      ],
    });
  const m = url.match(/^\/apps\/garden(\/.*)?$/);
  if (!m) return void res.writeHead(404).end();
  const headers: http.OutgoingHttpHeaders = { ...req.headers, host: `127.0.0.1:${TARGET}` };
  for (const k of Object.keys(headers)) if (k.startsWith("x-twodb-")) delete headers[k];
  const upstream = http.request(
    { host: "127.0.0.1", port: TARGET, path: m[1] || "/", method: req.method, headers: { ...headers, ...IDENTITY } },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => res.writeHead(502).end());
  req.pipe(upstream);
});

server.listen(PORT, "127.0.0.1", () => console.log(`garden dev shim on http://127.0.0.1:${PORT} → garden :${TARGET}`));
