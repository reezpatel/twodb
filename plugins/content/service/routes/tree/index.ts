import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { registerGetTree } from "./get-tree";
import { registerPostNodes } from "./post-nodes";
import { registerGetNode } from "./get-node";
import { registerPatchNode } from "./patch-node";
import { registerPostNodeMove } from "./post-node-move";
import { registerDeleteNode } from "./delete-node";

export function registerTreeRoutes(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	registerGetTree(fastify, ctx);
	registerPostNodes(fastify, ctx);
	registerGetNode(fastify, ctx);
	registerPatchNode(fastify, ctx);
	registerPostNodeMove(fastify, ctx);
	registerDeleteNode(fastify, ctx);
}
