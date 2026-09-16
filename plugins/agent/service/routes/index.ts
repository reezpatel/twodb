import type { TwodbFastifyInstance } from "@twodb/contracts";
import type { AgentCtx } from "../lib/ctx";
import { registerAgentRoutes } from "./agents";
import { registerThreadRoutes } from "./threads";
import { registerUsageRoutes } from "./usage";

export function registerRoutes(
	fastify: TwodbFastifyInstance,
	ctx: AgentCtx,
): void {
	registerAgentRoutes(fastify, ctx);
	registerUsageRoutes(fastify, ctx);
	registerThreadRoutes(fastify, ctx);
}
