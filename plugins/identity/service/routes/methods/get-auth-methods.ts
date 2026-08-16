import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { methodAllowedByMode } from "../../lib/users/methods";
import { PUBLIC } from "../../../shared/constants";

export function registerGetAuthMethods(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db, mode } = ctx;

	/** What the deployment offers — drives the login screen. */
	fastify.get("/auth/methods", PUBLIC, async () => {
		const rows = await db
			.selectFrom("deployment_auth_methods")
			.select(["method"])
			.where("enabled", "=", true)
			.execute();
		return {
			methods: rows
				.map((r) => r.method)
				.filter((m) => methodAllowedByMode(m, mode)),
		};
	});
}
