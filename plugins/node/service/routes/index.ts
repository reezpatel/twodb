import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import type { TwodbContext } from "@twodb/shared-backend";
import type { NodeDatabase } from "../db";
import { agentRoutes } from "./agent";
import { commandRoutes } from "./commands";
import { nodeRoutes } from "./nodes";
import { patchRoutes } from "./patches";

export async function registerRoutes(ctx: TwodbContext, app: FastifyInstance): Promise<void> {
  const kysely = ctx.db as unknown as Kysely<NodeDatabase>;
  await app.register(async (scope) => {
    await scope.register(agentRoutes(kysely));
    await scope.register(nodeRoutes(kysely));
    await scope.register(commandRoutes(kysely));
    await scope.register(patchRoutes(kysely));
  });
}
