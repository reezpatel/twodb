import { defineAppManifest } from "@twodb/core-platform/manifest";
import { allRoutes } from "./routes/index.js";

/** Endpoints are declared next to handlers via `route()`; the manifest derives from them. Run `pnpm gen:docs`. */
export const manifest = defineAppManifest({
  name: "Fincal",
  slug: "fincal",
  version: "0.1.0",
  shape: "backend+webapp",
  description:
    "Personal finance per space: accounts (bank/cash/UPI/credit card), expenses, budgets, envelopes, goals, investments " +
    "(stocks, mutual funds, metals, FDs, RDs, …), net-worth tracker, retirement planner, analytics and calculators. Workspace-level access.",
  capabilities: ["finance", "budgets", "investments"],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/fincal/api",
  endpoints: [...allRoutes.map((r) => r.spec)],
});

export default manifest;
