import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { toViewDto } from "../../lib/serialize";
import { sectionOf } from "../sections/index";

export function registerPostViewDefault(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.post(
		"/sections/:id/views/:viewId/default",
		async (request, reply) => {
			const node = await sectionOf(request, reply, ctx.db);
			if (!node) return reply;
			const { viewId } = request.params as { viewId: string };
			const view = await ctx.db.transaction().execute(async (trx) => {
				await trx
					.updateTable("content_views")
					.set({ is_default: false })
					.where("section_id", "=", node.id)
					.execute();
				const updated = await trx
					.updateTable("content_views")
					.set({ is_default: true, updated_at: new Date() })
					.where("id", "=", viewId)
					.where("section_id", "=", node.id)
					.where("deleted", "=", false)
					.returningAll()
					.executeTakeFirst();
				if (!updated) return null;
				await trx
					.updateTable("content_nodes")
					.set({ default_view: viewId, updated_at: new Date() })
					.where("id", "=", node.id)
					.execute();
				return updated;
			});
			if (!view) return reply.code(404).send({ error: "View not found." });
			fastify.bus.emit("io.twodb.content.view.defaulted", {
				workspaceId: node.workspace_id,
				sectionId: node.id,
				viewId,
			});
			return { view: toViewDto(view) };
		},
	);
}
