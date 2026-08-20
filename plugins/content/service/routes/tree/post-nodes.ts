import type { FastifyInstance } from "fastify";
import { newId } from "@twodb/shared-backend";
import type { ContentCtx } from "../../lib/ctx";
import { requireWorkspace } from "../../lib/require-workspace";
import { toNodeDto, toViewDto } from "../../lib/serialize";
import { nextPosition, propsTableName, uniqueIdentifier } from "../../lib/tree";
import { createPropsTable } from "../../lib/tables";
import { principalOf } from "./get-tree";

export function registerPostNodes(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.post("/nodes", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { userId } = principalOf(request);
		const body = request.body as {
			parent_id?: string | null;
			type?: string;
			name?: string;
			position?: number;
		};
		if (!body.name?.trim()) {
			return reply.code(400).send({ error: "Name is required." });
		}
		if (body.type !== "folder" && body.type !== "section") {
			return reply.code(400).send({ error: "Type must be folder or section." });
		}
		const parentId = body.parent_id ?? null;
		if (parentId) {
			const parent = await ctx.db
				.selectFrom("content_nodes")
				.select(["id", "type", "deleted"])
				.where("id", "=", parentId)
				.where("workspace_id", "=", workspaceId)
				.executeTakeFirst();
			if (!parent || parent.deleted || parent.type !== "folder") {
				return reply.code(400).send({ error: "Parent must be a live folder." });
			}
		}

		const id = newId("nod");
		const isSection = body.type === "section";
		const node = await ctx.db.transaction().execute(async (trx) => {
			const position =
				body.position ?? (await nextPosition(trx, workspaceId, parentId));
			const inserted = await trx
				.insertInto("content_nodes")
				.values({
					id,
					workspace_id: workspaceId,
					parent_id: parentId,
					type: body.type as "folder" | "section",
					name: body.name!.trim(),
					identifier: isSection
						? await uniqueIdentifier(trx, workspaceId, body.name!)
						: slugFallback(body.name!),
					position,
					created_by: userId,
				})
				.returningAll()
				.executeTakeFirstOrThrow();

			if (!isSection) return { node: inserted, view: null };

			// Section: empty props table + default list view (plan §3.4, §5.1).
			await createPropsTable(trx, propsTableName(id));
			const view = await trx
				.insertInto("content_views")
				.values({
					id: newId("viw"),
					section_id: id,
					workspace_id: workspaceId,
					name: "List",
					type: "list",
					is_default: true,
					position: 0,
				})
				.returningAll()
				.executeTakeFirstOrThrow();
			const withDefault = await trx
				.updateTable("content_nodes")
				.set({ default_view: view.id })
				.where("id", "=", id)
				.returningAll()
				.executeTakeFirstOrThrow();
			return { node: withDefault, view };
		});

		fastify.bus.emit("io.twodb.content.node.created", {
			workspaceId,
			nodeId: id,
			type: body.type,
		});
		return reply.code(201).send({
			node: toNodeDto(node.node),
			view: node.view ? toViewDto(node.view) : null,
		});
	});
}

function slugFallback(name: string): string {
	return name.trim().toLowerCase().slice(0, 200);
}
