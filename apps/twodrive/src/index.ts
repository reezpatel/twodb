// Scaffolded stub server — the app is not implemented yet (see AGENTS.md).
// It still runs a real HTTP server so `pnpm local` can boot the whole
// ecosystem and TwoDB's pull-registration can fetch a live manifest:
// /healthz always answers, /internal/manifest is served only when the
// orchestrator injected a TWODB_PROVISION_TOKEN (docker-install flow).
import { serve } from "@hono/node-server";
import { handleManifestRequest, INTERNAL_MANIFEST_PATH, REGISTRATION_TOKEN_HEADER } from "@twodb/core-platform/manifest";
import { manifest } from "./manifest.js";

const port = Number(process.env.PORT ?? 6405);
const registrationToken = process.env.TWODB_PROVISION_TOKEN;

serve({
  port,
  fetch: (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/healthz") return Response.json({ ok: true, app: manifest.slug, scaffolded: true });
    if (url.pathname === "" && registrationToken) {
      const res = handleManifestRequest(
        { ...manifest, version: "0.1.0" },
        { registrationToken, httpUrl: process.env.HTTP_URL ?? `http://localhost:${port}` },
        req.headers.get(REGISTRATION_TOKEN_HEADER) ?? undefined,
      );
      return Response.json(res.body, { status: res.status });
    }
    return new Response("not found", { status: 404 });
  },
});

console.log(`${manifest.name} (scaffolded) listening on :${port}`);
