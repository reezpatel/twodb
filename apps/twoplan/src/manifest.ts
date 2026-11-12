import { z } from "zod";
import { defineAppManifest, defineEndpoint } from "@twodb/core-platform/manifest";
import { allRoutes } from "./routes/index.js";

/**
 * Single source of truth: every endpoint is declared next to its handler via `route()`
 * (src/routes/*), and the manifest is derived from that list so docs/CLI and the
 * server can never drift. Run `pnpm gen:docs` after changes.
 */
export const manifest = defineAppManifest({
  name: "TwoPlan",
  slug: "twoplan",
  version: "0.1.0",
  shape: "backend+webapp",
  description:
    "Project management: Space → Project (KEY) → epics, milestones and tickets. Kanban/table/timeline views, " +
    "sub-tasks, checklists, links, custom fields, saved views, docs, dashboards, inbox, CSV/Linear import. Workspace-level access.",
  capabilities: ["projects", "tickets"],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/twoplan",
  endpoints: [...allRoutes.map((r) => r.spec)],
});

export default manifest;
