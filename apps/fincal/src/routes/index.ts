import type { RouteDef } from "../lib/route.js";
import { ledgerRoutes } from "./ledger.js";
import { planningRoutes } from "./planning.js";
import { wealthRoutes } from "./wealth.js";
import { insightRoutes } from "./insights.js";

export const allRoutes: RouteDef[] = [...ledgerRoutes, ...planningRoutes, ...wealthRoutes, ...insightRoutes];
