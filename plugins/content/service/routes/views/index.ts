import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { registerGetViews } from "./get-views";
import { registerPostView } from "./post-view";
import { registerPatchView } from "./patch-view";
import { registerPostViewDefault } from "./post-view-default";
import { registerDeleteView } from "./delete-view";

export function registerViewRoutes(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	registerGetViews(fastify, ctx);
	registerPostView(fastify, ctx);
	registerPatchView(fastify, ctx);
	registerPostViewDefault(fastify, ctx);
	registerDeleteView(fastify, ctx);
}
