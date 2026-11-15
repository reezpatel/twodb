// Scaffolded stub server — the app is not implemented yet (see AGENTS.md).
// It still serves its bundled webapp (outside /api), registers + heartbeats with the control
// plane so `pnpm local` can boot the whole ecosystem; it has no database yet,
// so only the lightweight session is started (no Postgres is provisioned).
import Fastify from "fastify";
import { startTwoDbSession } from "@twodb/twodb-core";
import { webappRewriteUrl, registerWebapp, webappDist } from "@twodb/twodb-core/webapp";
import { manifest } from "./manifest.js";

const port = Number(process.env.PORT ?? 6409);
const httpUrl = process.env.HTTP_URL ?? `http://localhost:${port}`;

const app = Fastify({ logger: true, rewriteUrl: webappRewriteUrl });
app.get("/healthz", async () => ({ ok: true, app: manifest.slug, scaffolded: true }));
await registerWebapp(app, { distDir: webappDist(import.meta.dirname) });
await app.listen({ port, host: "0.0.0.0" });

startTwoDbSession({ manifest: { ...manifest, version: "0.1.0" }, httpUrl })
  .then((session) => {
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => void session.close());
  })
  .catch((err) => console.warn(`[${manifest.slug}] registration with TwoDB failed:`, err.message));
