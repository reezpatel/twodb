import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import {
	getDeploymentMethod,
	methodAllowedByMode,
} from "../../lib/users/methods";
import { requireSuperadmin } from "../../lib/admin/admin";

export function registerPutAdminAuthMethods(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db, mode } = ctx;
	const gate = requireSuperadmin(fastify);

	fastify.put(
		"/admin/auth-methods",
		{ preHandler: gate },
		async (request, reply) => {
			const body = request.body as {
				method?: string;
				enabled?: boolean;
				config?: Record<string, unknown>;
			};
			const method = body.method ?? "";
			const valid =
				["password", "email_link", "phone_otp"].includes(method) ||
				/^sso\.[a-z0-9._-]+$/.test(method);
			if (!valid || typeof body.enabled !== "boolean") {
				return reply.code(400).send({
					error:
						"method (password | email_link | phone_otp | sso.<provider>) and enabled are required.",
				});
			}
			if (!methodAllowedByMode(method, mode)) {
				return reply.code(400).send({
					error: `${method} needs a different identifier mode on this server.`,
				});
			}
			const config = (body.config ?? {}) as Record<string, unknown>;
			if (method.startsWith("sso.") && body.enabled) {
				const hasEndpoints =
					typeof config.authorizationEndpoint === "string" &&
					typeof config.tokenEndpoint === "string" &&
					typeof config.userinfoEndpoint === "string";
				if (
					typeof config.clientId !== "string" ||
					typeof config.clientSecret !== "string" ||
					(typeof config.issuer !== "string" && !hasEndpoints)
				) {
					return reply.code(400).send({
						error:
							"An SSO provider needs clientId, clientSecret, and either an issuer (for discovery) or explicit endpoints.",
					});
				}
			}
			await db
				.insertInto("deployment_auth_methods")
				.values({ method, config, enabled: body.enabled })
				.onConflict((oc) =>
					oc.column("method").doUpdateSet({
						enabled: body.enabled!,
						// Config only changes when sent — toggling never wipes it.
						...(body.config ? { config } : {}),
					}),
				)
				.execute();
			fastify.bus.emit("twodb.identity.authmethod.configured", { method });
			return { ok: true };
		},
	);
}
