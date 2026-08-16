import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { CurrentUser } from "@twodb/contracts";
declare module "fastify" {
	interface FastifyRequest {
		/** The authenticated identity for this request. */
		user: CurrentUser;
	}
}

/**
 * Core auth plugin — currently a local single-user stub: every request is
 * attributed to the local user. When real auth lands, this plugin is the one
 * place that changes; services keep reading `request.user`.
 */
export const authPlugin = fp(
	async (fastify: FastifyInstance) => {
		fastify.decorateRequest("user");
		fastify.addHook("onRequest", async (request: FastifyRequest) => {
			request.user = { id: "local-user", name: "Local User" };
		});
	},
	{ name: "twodb-auth" },
);
