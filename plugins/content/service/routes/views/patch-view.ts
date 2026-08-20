import type { FastifyInstance } from "fastify";
import type { ContentViewConfig } from "@twodb/contracts";
import type { ContentCtx } from "../../lib/ctx";
import { toViewDto } from "../../lib/serialize";
import { sectionOf } from "../sections/index";

export function registerPatchView(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.patch("/sections/:id/views/:viewId", async (request, reply) => {
		const node = await sectionOf(request, reply, ctx.db);
		if (!node) return reply;
		const { viewId } = request.params as { viewId: string };
		const body = request.body as {
			name?: string;
			config?: ContentViewConfig;
			position?: number;
		};
		const patch: Record<string, unknown> = { updated_at: new Date() };
		if (body.name !== undefined) {
			if (!body.name.trim()) {
				return reply.code(400).send({ error: "Name cannot be empty." });
			}
			patch.name = body.name.trim();
		}
		if (body.config !== undefined) patch.config = body.config;
		if (body.position !== undefined) patch.position = body.position;

		const view = await ctx.db
			.updateTable("content_views")
			.set(patch)
			.where("id", "=", viewId)
			.where("section_id", "=", node.id)
			.returningAll()
			.executeTakeFirst();
		if (!view) return reply.code(404).send({ error: "View not found." });
		fastify.bus.emit("io.twodb.content.view.updated", {
			workspaceId: node.workspace_id,
			sectionId: node.id,
			viewId,
		});
		return { view: toViewDto(view) };
	});
}
