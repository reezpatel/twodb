import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { reorderRow, RowError } from "../../lib/rows";
import { sendError } from "../../lib/send-error";
import { sectionOf } from "../sections/index";

export function registerPostRowsReorder(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.post("/sections/:id/rows/reorder", async (request, reply) => {
		const node = await sectionOf(request, reply, ctx.db);
		if (!node) return reply;
		const body = request.body as {
			row_id?: string;
			before_row_id?: string | null;
			after_row_id?: string | null;
		};
		if (!body.row_id) {
			return reply.code(400).send({ error: "row_id is required." });
		}
		try {
			const position = await reorderRow(
				ctx.db,
				node,
				body.row_id,
				body.before_row_id ?? null,
				body.after_row_id ?? null,
			);
			return { row_id: body.row_id, position };
		} catch (err) {
			if (err instanceof RowError) return sendError(reply, err);
			throw err;
		}
	});
}
