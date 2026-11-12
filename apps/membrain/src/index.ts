// Scaffolded stub server — the app is not implemented yet (see AGENTS.md).
// It still runs a real HTTP server and registers + heartbeats with the control
// plane so `pnpm local` can boot the whole ecosystem; it has no database yet,
// so only the lightweight session is started (no Postgres is provisioned).
import { serve } from "@hono/node-server";
import { startTwoDbSession } from "@twodb/twodb-core";
import { manifest } from "./manifest.js";

const port = Number(process.env.PORT ?? 6413);
const httpUrl = process.env.HTTP_URL ?? `http://localhost:${port}`;

serve({
  port,
  fetch: (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/healthz") return Response.json({ ok: true, app: manifest.slug, scaffolded: true });
    return new Response("not found", { status: 404 });
  },
});

console.log(`${manifest.name} (scaffolded) listening on :${port}`);

startTwoDbSession({ manifest: { ...manifest, version: "0.1.0" }, httpUrl })
  .then((session) => {
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => void session.close());
  })
  .catch((err) => console.warn(`[${manifest.slug}] registration with TwoDB failed:`, err.message));
