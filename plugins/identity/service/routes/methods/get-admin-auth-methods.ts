import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { requireSuperadmin } from "../../lib/admin/admin";

export function registerGetAdminAuthMethods(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db } = ctx;
	const gate = requireSuperadmin(fastify);

	fastify.get("/admin/auth-methods", { preHandler: gate }, async () => {
		const rows = await db
			.selectFrom("deployment_auth_methods")
			.select(["method", "enabled", "config"])
			.orderBy("method")
			.execute();
		return {
			methods: rows.map((r) => ({
				method: r.method,
				enabled: r.enabled,
				// Never hand client secrets back over the wire.
				config: {
					...r.config,
					clientSecret: r.config.clientSecret ? "•••" : undefined,
				},
			})),
		};
	});
}
