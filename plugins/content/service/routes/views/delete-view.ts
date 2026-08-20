import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { sectionOf } from "../sections/index";

export function registerDeleteView(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.delete("/sections/:id/views/:viewId", async (request, reply) => {
		const node = await sectionOf(request, reply, ctx.db);
		if (!node) return reply;
		const { viewId } = request.params as { viewId: string };

		const deleted = await ctx.db.transaction().execute(async (trx) => {
			const existing = await trx
				.selectFrom("content_views")
				.select(["id", "is_default"])
				.where("id", "=", viewId)
				.where("section_id", "=", node.id)
				.executeTakeFirst();
			if (!existing) return false;
			await trx.deleteFrom("content_views").where("id", "=", viewId).execute();
			if (existing.is_default) {
				// Promote the oldest remaining view and sync the node pointer.
				const next = await trx
					.selectFrom("content_views")
					.select("id")
					.where("section_id", "=", node.id)
					.where("deleted", "=", false)
					.orderBy("created_at", "asc")
					.limit(1)
					.executeTakeFirst();
				await trx
					.updateTable("content_views")
					.set({ is_default: true })
					.where("id", "=", next?.id ?? "")
					.execute();
				await trx
					.updateTable("content_nodes")
					.set({ default_view: next?.id ?? null, updated_at: new Date() })
					.where("id", "=", node.id)
					.execute();
			}
			return true;
		});
		if (!deleted) return reply.code(404).send({ error: "View not found." });
		fastify.bus.emit("io.twodb.content.view.deleted", {
			workspaceId: node.workspace_id,
			sectionId: node.id,
			viewId,
		});
		return reply.code(204).send();
	});
}
