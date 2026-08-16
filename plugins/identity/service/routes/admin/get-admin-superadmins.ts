import type { FastifyInstance } from "fastify";
import { typedDb } from "@twodb/shared-backend";
import type { AuthCtx } from "../../lib/auth/ctx";
import type { IdentityDB } from "../../db/schema";
import { adminGate } from "./shared";

export function registerGetAdminSuperadmins(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const db = typedDb<IdentityDB>(fastify);
	const gate = adminGate(fastify);

	fastify.get("/admin/superadmins", { preHandler: gate }, async () => {
		const rows = await db
			.selectFrom("platform_admins")
			.innerJoin("users", "users.id", "platform_admins.user_id")
			.select([
				"users.id",
				"users.name",
				"users.email",
				"platform_admins.granted_by",
				"platform_admins.created_at",
			])
			.execute();
		return {
			superadmins: rows.map((r) => ({
				userId: r.id,
				name: r.name,
				email: r.email,
				grantedBy: r.granted_by,
				createdAt: r.created_at,
			})),
		};
	});
}
