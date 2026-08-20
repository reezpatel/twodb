import type { TwodbFastifyInstance } from "@twodb/contracts";
import type { ContentCtx } from "../lib/ctx";
import { registerTreeRoutes } from "./tree";
import { registerSectionRoutes } from "./sections";
import { registerRowRoutes } from "./rows";
import { registerViewRoutes } from "./views";

export function registerRoutes(
	fastify: TwodbFastifyInstance,
	ctx: ContentCtx,
): void {
	registerTreeRoutes(fastify, ctx);
	registerSectionRoutes(fastify, ctx);
	registerRowRoutes(fastify, ctx);
	registerViewRoutes(fastify, ctx);
}
