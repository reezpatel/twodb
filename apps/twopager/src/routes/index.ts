import type { RouteDef } from "../lib/route.js";
import { siteRoutes } from "./sites.js";
import { versionRoutes } from "./versions.js";

export const allRoutes: RouteDef[] = [...siteRoutes, ...versionRoutes];
