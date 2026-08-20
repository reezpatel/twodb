import type { FastifyInstance } from "fastify";
import type { ContentFilter, ContentSort } from "@twodb/contracts";
import type { ContentCtx } from "../../lib/ctx";
import { listRows, RowError } from "../../lib/rows";
import { sendError } from "../../lib/send-error";
import { sectionOf } from "../sections/index";

export function registerGetRows(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.get("/sections/:id/rows", async (request, reply) => {
		const node = await sectionOf(request, reply, ctx.db);
		if (!node) return reply;
		const query = request.query as {
			filters?: string;
			sorts?: string;
			search?: string;
			limit?: string;
			cursor?: string;
			deleted?: string;
		};
		try {
			const result = await listRows(ctx.db, node, {
				filters: parseJson<ContentFilter[]>(query.filters),
				sorts: parseJson<ContentSort[]>(query.sorts),
				search: query.search,
				limit: query.limit ? Number(query.limit) : undefined,
				cursor: query.cursor,
				includeDeleted: query.deleted === "true",
			});
			return result;
		} catch (err) {
			if (err instanceof RowError) return sendError(reply, err);
			throw err;
		}
	});
}

function parseJson<T>(raw: string | undefined): T | undefined {
	if (!raw) return undefined;
	try {
		return JSON.parse(raw) as T;
	} catch {
		throw new RowError(400, "filters/sorts must be valid JSON.");
	}
}
