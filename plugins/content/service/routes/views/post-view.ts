import type { FastifyInstance } from "fastify";
import { newId } from "@twodb/shared-backend";
import type { ContentViewConfig, ContentViewType } from "@twodb/contracts";
import { VIEW_TYPES } from "../../../shared/constants";
import type { ContentCtx } from "../../lib/ctx";
import { toViewDto } from "../../lib/serialize";
import { sectionOf } from "../sections/index";

const POSITION_GAP = 1024;

export function registerPostView(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.post("/sections/:id/views", async (request, reply) => {
		const node = await sectionOf(request, reply, ctx.db);
		if (!node) return reply;
		const body = request.body as {
			name?: string;
			type?: ContentViewType;
			config?: ContentViewConfig;
			is_default?: boolean;
		};
		if (!body.name?.trim()) {
			return reply.code(400).send({ error: "Name is required." });
		}
		if (!body.type || !VIEW_TYPES.includes(body.type)) {
			return reply
				.code(400)
				.send({ error: `Type must be one of ${VIEW_TYPES.join(", ")}.` });
		}

		const view = await ctx.db.transaction().execute(async (trx) => {
			const last = await trx
				.selectFrom("content_views")
				.select("position")
				.where("section_id", "=", node.id)
				.orderBy("position", "desc")
				.limit(1)
				.executeTakeFirst();
			if (body.is_default) {
				await trx
					.updateTable("content_views")
					.set({ is_default: false })
					.where("section_id", "=", node.id)
					.execute();
			}
			const inserted = await trx
				.insertInto("content_views")
				.values({
					id: newId("viw"),
					section_id: node.id,
					workspace_id: node.workspace_id,
					name: body.name!.trim(),
					type: body.type!,
					config: body.config ?? {},
					is_default: body.is_default ?? false,
					position: (last?.position ?? 0) + POSITION_GAP,
				})
				.returningAll()
				.executeTakeFirstOrThrow();
			if (inserted.is_default) {
				await trx
					.updateTable("content_nodes")
					.set({ default_view: inserted.id, updated_at: new Date() })
					.where("id", "=", node.id)
					.execute();
			}
			return inserted;
		});
		fastify.bus.emit("io.twodb.content.view.created", {
			workspaceId: node.workspace_id,
			sectionId: node.id,
			viewId: view.id,
		});
		return reply.code(201).send({ view: toViewDto(view) });
	});
}
