import { defineAppManifest } from "@twodb/core-platform/manifest";

// Declare this app's endpoints here as the feature set gets built — see
// apps/twodb/src/manifest.ts or apps/tworoute/src/manifest.ts for a fully
// worked example (defineEndpoint + Zod request/response schemas). Run
// `pnpm gen:docs` after any change to regenerate ENDPOINTS.md/endpoint.json.
export const manifest = defineAppManifest({
  name: "TwoDrive",
  slug: "twodrive",
  version: "0.1.0",
  shape: "backend+webapp",
  description: "Drive/file management — not yet implemented. See AGENTS.md before building it out.",
  capabilities: [],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/twodrive",
  endpoints: [],
});

export default manifest;
