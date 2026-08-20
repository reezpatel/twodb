import type { FastifyInstance } from "fastify";
import type { ContentColumnConfig } from "@twodb/contracts";
import type { ContentCtx } from "../../lib/ctx";
import { addColumn, ColumnError } from "../../lib/columns/columns";
import { sendError } from "../../lib/send-error";
import { sectionOf } from "./index";

export function registerPostColumns(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.post("/sections/:id/columns", async (request, reply) => {
		const node = await sectionOf(request, reply, ctx.db);
		if (!node) return reply;
		const body = request.body as {
			name?: string;
			type?: string;
			options?: ContentColumnConfig["options"];
			relation?: ContentColumnConfig["relation"];
			position?: number;
		};
		try {
			const column = await ctx.db.transaction().execute((trx) =>
				addColumn(trx, node, {
					name: body.name ?? "",
					type: body.type ?? "",
					options: body.options,
					relation: body.relation,
					position: body.position,
				}),
			);
			fastify.bus.emit("io.twodb.content.column.added", {
				workspaceId: node.workspace_id,
				sectionId: node.id,
				columnId: column.column_id,
			});
			return reply.code(201).send({ column: { ...column, mandatory: false } });
		} catch (err) {
			if (err instanceof ColumnError) return sendError(reply, err);
			throw err;
		}
	});
}
