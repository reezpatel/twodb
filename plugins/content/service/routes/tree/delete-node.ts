import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { requireWorkspace } from "../../lib/require-workspace";
import { resolveNode } from "../../lib/resolve-node";
import { propsTableName } from "../../lib/tree";
import { dropPropsTable } from "../../lib/tables";

export function registerDeleteNode(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.delete("/nodes/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as { id: string };
		const { hard } = request.query as { hard?: string };
		const node = await resolveNode(ctx.db, workspaceId, id, {
			includeDeleted: hard === "true",
		});
		if (!node) return reply.code(404).send({ error: "Node not found." });

		// Collect the subtree (node first, descendants breadth-first).
		const subtree: { id: string; type: string }[] = [
			{ id: node.id, type: node.type },
		];
		const frontier = [node.id];
		while (frontier.length > 0) {
			const batch = frontier.splice(0, frontier.length);
			const children = await ctx.db
				.selectFrom("content_nodes")
				.select(["id", "type"])
				.where("workspace_id", "=", workspaceId)
				.where("parent_id", "in", batch)
				.execute();
			subtree.push(...children);
			frontier.push(...children.map((c) => c.id));
		}

		if (hard === "true") {
			// Deepest first so parent FK restrict never trips; notes/views
			// cascade on the node delete.
			for (const item of [...subtree].reverse()) {
				if (item.type === "section") {
					await dropPropsTable(ctx.db, propsTableName(item.id));
				}
				await ctx.db
					.deleteFrom("content_nodes")
					.where("id", "=", item.id)
					.execute();
			}
		} else {
			await ctx.db
				.updateTable("content_nodes")
				.set({ deleted: true, updated_at: new Date() })
				.where(
					"id",
					"in",
					subtree.map((n) => n.id),
				)
				.execute();
		}
		fastify.bus.emit("io.twodb.content.node.deleted", {
			workspaceId,
			nodeId: node.id,
			hard: hard === "true",
		});
		return reply.code(204).send();
	});
}
