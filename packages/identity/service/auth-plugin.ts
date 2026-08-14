import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE, type Principal } from "@twodb/contracts";
import { typedDb } from "@twodb/shared-backend";
import type { IdentityDB } from "./schema";
import { resolveSession } from "./sessions";

declare module "fastify" {
	interface FastifyRequest {
		principal: Principal | null;
	}
}

export const identityAuthPlugin = fp(
	async (fastify: FastifyInstance) => {
		fastify.decorateRequest("principal", null);
		fastify.addHook("onRequest", async (request, reply) => {
			const token = request.cookies[SESSION_COOKIE];
			request.principal = token
				? await resolveSession(typedDb<IdentityDB>(fastify), token)
				: null;

			const isApiRoute = request.url.startsWith("/api/v1/");
			if (isApiRoute) {
				request.log.info(
					{ principal: request.principal?.userId ?? null },
					"principal resolved",
				);
			}

			const isPublic =
				(request.routeOptions.config as { public?: boolean }).public === true;
			if (isApiRoute && !isPublic && !request.principal) {
				return reply.code(401).send({ error: "Sign in to continue." });
			}
		});
	},
	{ name: "twodb-identity-auth" },
);
