import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE, type Principal } from "@twodb/contracts";
import { typedDb } from "@twodb/shared-backend";
import type { IdentifierMode, IdentityDB } from "./schema";
import { userVerified } from "./methods";
import { resolveSession } from "./sessions";

declare module "fastify" {
	interface FastifyRequest {
		principal: Principal | null;
	}
}

export const identityAuthPlugin = fp(
	async (fastify: FastifyInstance) => {
		const config = (
			fastify as unknown as {
				config: {
					TWODB_IDENTIFIER: IdentifierMode;
					TWODB_REQUIRE_VERIFIED: boolean;
				};
			}
		).config;
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

			const routeConfig = request.routeOptions.config as {
				public?: boolean;
				verifyExempt?: boolean;
			};
			if (
				isApiRoute &&
				routeConfig.public !== true &&
				!request.principal
			) {
				return reply.code(401).send({ error: "Sign in to continue." });
			}

			// Stage 2: the verified-only gate. Unverified sessions are confined
			// to the verification endpoints (and session/logout) until they hold
			// the mode-required verified_at stamp.
			if (
				isApiRoute &&
				routeConfig.public !== true &&
				routeConfig.verifyExempt !== true &&
				request.principal &&
				config.TWODB_REQUIRE_VERIFIED
			) {
				const user = await typedDb<IdentityDB>(fastify)
					.selectFrom("users")
					.select(["email_verified_at", "phone_verified_at"])
					.where("id", "=", request.principal.userId)
					.executeTakeFirst();
				if (!user || !userVerified(user, config.TWODB_IDENTIFIER)) {
					return reply.code(403).send({ error: "verify_required" });
				}
			}
		});
	},
	{ name: "twodb-identity-auth" },
);
