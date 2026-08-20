import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { requireWorkspace } from "../../lib/require-workspace";
import { resolveNode } from "../../lib/resolve-node";
import { toNodeDto } from "../../lib/serialize";
import { slugify } from "../../lib/tree";

export function registerPatchNode(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.patch("/nodes/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as { id: string };
		const body = request.body as {
			name?: string;
			identifier?: string;
			show_in_overview?: boolean;
			default_view?: string | null;
		};
		const node = await resolveNode(ctx.db, workspaceId, id);
		if (!node) return reply.code(404).send({ error: "Node not found." });

		const patch: Record<string, unknown> = { updated_at: new Date() };
		if (body.name !== undefined) {
			if (!body.name.trim()) {
				return reply.code(400).send({ error: "Name cannot be empty." });
			}
			patch.name = body.name.trim();
		}
		if (body.identifier !== undefined) {
			if (node.type !== "section") {
				return reply
					.code(400)
					.send({ error: "Only sections have identifiers." });
			}
			patch.identifier = slugify(body.identifier);
		}
		if (body.show_in_overview !== undefined) {
			patch.show_in_overview = body.show_in_overview;
		}
		if (body.default_view !== undefined) {
			if (node.type !== "section") {
				return reply.code(400).send({ error: "Folders have no views." });
			}
			if (body.default_view !== null) {
				const view = await ctx.db
					.selectFrom("content_views")
					.select("id")
					.where("id", "=", body.default_view)
					.where("section_id", "=", node.id)
					.where("deleted", "=", false)
					.executeTakeFirst();
				if (!view) {
					return reply.code(400).send({ error: "Unknown view." });
				}
			}
			patch.default_view = body.default_view;
		}

		let updated;
		try {
			updated = await ctx.db
				.updateTable("content_nodes")
				.set(patch)
				.where("id", "=", node.id)
				.returningAll()
				.executeTakeFirstOrThrow();
		} catch (err) {
			if ((err as { code?: string }).code === "23505") {
				return reply.code(409).send({ error: "That identifier is taken." });
			}
			throw err;
		}
		if (body.name !== undefined) {
			fastify.bus.emit("io.twodb.content.node.renamed", {
				workspaceId,
				nodeId: node.id,
				name: updated.name,
			});
		}
		return { node: toNodeDto(updated) };
	});
}
