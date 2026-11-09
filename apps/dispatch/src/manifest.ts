import { defineAppManifest } from "@twodb/core-platform/manifest";

// Declare this app's endpoints here as the feature set gets built — see
// apps/twodb/src/manifest.ts or apps/tworoute/src/manifest.ts for a fully
// worked example (defineEndpoint + Zod request/response schemas). Run
// `pnpm gen:docs` after any change to regenerate ENDPOINTS.md/endpoint.json.
export const manifest = defineAppManifest({
  name: "Dispatch",
  slug: "dispatch",
  version: "0.1.0",
  shape: "backend",
  description: "Remote command runner — not yet implemented. See AGENTS.md before building it out.",
  capabilities: [],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/dispatch",
  endpoints: [],
});

export default manifest;
