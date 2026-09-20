import type { FastifyInstance } from "fastify";
import type { TwodbContext } from "@twodb/shared-backend";
import { db } from "../db";
import type { RouteDeps } from "../lib/types";
import { completionRoutes } from "./completions";
import { connectionRoutes } from "./connections";
import { overviewRoutes } from "./overview";
import { settingsRoutes } from "./settings";
import { tuningRoutes } from "./tuning";
import { usageRoutes } from "./usage";

export async function registerRoutes(ctx: TwodbContext, app: FastifyInstance): Promise<void> {
  const deps: RouteDeps = { ctx, kysely: db(ctx) };

  await app.register(overviewRoutes(deps));
  await app.register(settingsRoutes(deps));
  await app.register(connectionRoutes(deps));
  await app.register(tuningRoutes(deps));
  await app.register(usageRoutes(deps));
  await app.register(completionRoutes(deps));
}
