import { defineAppManifest } from "@twodb/core-platform/manifest";
import { allRoutes } from "./routes/index.js";

/** Endpoints are declared next to handlers via `route()`; the manifest derives from them. Run `pnpm gen:docs`. */
export const manifest = defineAppManifest({
  name: "TwoPager",
  slug: "twopager",
  version: "0.1.0",
  shape: "backend+webapp",
  description:
    "Static site hosting and the gateway's catch-all: landing pages on custom domains. A site belongs to a space and has versions " +
    "(one active, Firebase-Hosting style); agents add pages to a draft version or upload a zip. SPA rewrites, redirects and headers per version. " +
    "Files live in S3, records in Postgres, and are served from a local cache.",
  capabilities: ["sites", "hosting", "static-sites"],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/twopager/api",
  endpoints: [...allRoutes.map((r) => r.spec)],
});

export default manifest;
