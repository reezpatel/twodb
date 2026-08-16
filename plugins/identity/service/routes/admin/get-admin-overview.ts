import type { FastifyInstance } from "fastify";
import { typedDb } from "@twodb/shared-backend";
import type { AuthCtx } from "../../lib/auth/ctx";
import type { IdentityDB } from "../../db/schema";
import { adminGate } from "./shared";

export function registerGetAdminOverview(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const db = typedDb<IdentityDB>(fastify);
	const gate = adminGate(fastify);

	fastify.get("/admin/overview", { preHandler: gate }, async () => {
		const [users, orgs, workspaces, sessions] = await Promise.all([
			db
				.selectFrom("users")
				.select((eb) => eb.fn.count<number>("id").as("c"))
				.executeTakeFirst(),
			db
				.selectFrom("organizations")
				.select((eb) => eb.fn.count<number>("id").as("c"))
				.executeTakeFirst(),
			db
				.selectFrom("workspaces")
				.select((eb) => eb.fn.count<number>("id").as("c"))
				.executeTakeFirst(),
			db
				.selectFrom("sessions")
				.select((eb) => eb.fn.count<number>("id").as("c"))
				.where("expires_at", ">", new Date())
				.executeTakeFirst(),
		]);
		const methods = await db
			.selectFrom("deployment_auth_methods")
			.select(["method", "enabled"])
			.execute();
		return {
			users: Number(users?.c ?? 0),
			orgs: Number(orgs?.c ?? 0),
			workspaces: Number(workspaces?.c ?? 0),
			sessionsActive: Number(sessions?.c ?? 0),
			methodsEnabled: methods.filter((m) => m.enabled).length,
		};
	});
}
