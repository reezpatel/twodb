import type { FastifyInstance } from "fastify";
import type { ContentSchemaColumn, ContentColumnType } from "@twodb/contracts";
import { CORE_COLUMNS } from "../../../shared/constants";
import type { ContentCtx } from "../../lib/ctx";
import { toNodeDto } from "../../lib/serialize";
import { sectionOf } from "./index";

export function registerGetSchema(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.get("/sections/:id/schema", async (request, reply) => {
		const node = await sectionOf(request, reply, ctx.db);
		if (!node) return reply;
		const mandatory: ContentSchemaColumn[] = CORE_COLUMNS.map((c, i) => ({
			column_id: c.column_id,
			name: c.name,
			type: c.type as ContentColumnType,
			position: -CORE_COLUMNS.length + i,
			mandatory: true,
		}));
		const user = [...(node.columns_config ?? [])]
			.sort((a, b) => a.position - b.position)
			.map((c) => ({ ...c, mandatory: false }));
		return { section: toNodeDto(node), columns: [...mandatory, ...user] };
	});
}
