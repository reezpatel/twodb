import type { TwodbFastifyInstance } from "@twodb/contracts";
import type { CodeCtx } from "../lib/ctx";
import { registerPickerRoutes } from "./pickers";
import { registerSessionRoutes } from "./sessions";
import { registerSessionStreamRoutes } from "./session-stream";

export function registerRoutes(
	fastify: TwodbFastifyInstance,
	ctx: CodeCtx,
): void {
	registerPickerRoutes(fastify);
	registerSessionRoutes(fastify, ctx);
	registerSessionStreamRoutes(fastify, ctx);
}
