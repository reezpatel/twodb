import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { registerGetRows } from "./get-rows";
import { registerPostRow } from "./post-row";
import { registerGetRow } from "./get-row";
import { registerGetRowContent } from "./get-row-content";
import { registerPatchRow } from "./patch-row";
import { registerDeleteRow } from "./delete-row";
import { registerPostRowMove } from "./post-row-move";
import { registerPostRowsReorder } from "./post-rows-reorder";

export function registerRowRoutes(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	registerGetRows(fastify, ctx);
	registerPostRow(fastify, ctx);
	registerGetRow(fastify, ctx);
	registerGetRowContent(fastify, ctx);
	registerPatchRow(fastify, ctx);
	registerDeleteRow(fastify, ctx);
	registerPostRowMove(fastify, ctx);
	registerPostRowsReorder(fastify, ctx);
}
