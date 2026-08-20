import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { toViewDto } from "../../lib/serialize";
import { sectionOf } from "../sections/index";

export function registerGetViews(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.get("/sections/:id/views", async (request, reply) => {
		const node = await sectionOf(request, reply, ctx.db);
		if (!node) return reply;
		const views = await ctx.db
			.selectFrom("content_views")
			.selectAll()
			.where("section_id", "=", node.id)
			.where("deleted", "=", false)
			.orderBy("position", "asc")
			.execute();
		return { views: views.map(toViewDto) };
	});
}
