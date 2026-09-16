import type { TwodbFastifyInstance } from "@twodb/contracts";
import type { NodeCtx } from "../lib/ctx";
import { registerNodeRoutes } from "./nodes";
import { registerSecretRoutes } from "./secrets";

export function registerRoutes(
	fastify: TwodbFastifyInstance,
	ctx: NodeCtx,
): void {
	registerNodeRoutes(fastify, ctx);
	registerSecretRoutes(fastify, ctx);
	ctx.gateway.registerRoutes(fastify);
}
