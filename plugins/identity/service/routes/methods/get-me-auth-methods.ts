import type { FastifyInstance } from "fastify";
import type { Principal } from "../../lib/types";
import type { AuthCtx } from "../../lib/auth/ctx";
import { listUserMethods } from "../../lib/users/methods";

export function registerGetMeAuthMethods(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db } = ctx;

	fastify.get("/me/auth-methods", async (request) => {
		const { userId } = request.principal as Principal;
		const rows = await listUserMethods(db, userId);
		return {
			methods: rows.map((m) => ({
				id: m.id,
				method: m.method,
				enabled: m.enabled,
				createdAt: m.created_at,
			})),
		};
	});
}
