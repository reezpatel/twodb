import type { FastifyInstance } from "fastify";
import { typedDb } from "@twodb/shared-backend";
import type { IdentityDB } from "./schema";
import { audit, requireSuperadmin } from "./admin";

const ADMIN_GATE = requireSuperadmin;
void ADMIN_GATE;

/**
 * Superadmin / deployment settings (task-08 §8.4).
 * Every route is gated by `requireSuperadmin`. Mutations go through
 * the `audit(...)` helper which writes to `audit_log` AND emits a
 * bus fact (typed in @twodb/contracts).
 */
export function registerAdminRoutes(fastify: FastifyInstance) {
	const gate = ADMIN_GATE(fastify);

	fastify.put("/admin/access-policy", { preHandler: gate }, async (request, reply) => {
		const body = request.body as {
			require_verified?: boolean;
		};
		if (typeof body.require_verified !== "boolean") {
			return reply.code(400).send({
				error: "require_verified must be a boolean.",
			});
		}
		const db = typedDb<IdentityDB>(fastify);
		await db
			.insertInto("deployment_settings")
			.values({
				key: "require_verified",
				value: body.require_verified,
			})
			.onConflict((oc) =>
				oc.column("key").doUpdateSet({ value: body.require_verified }),
			)
			.execute();
		await audit(fastify, {
			actor: request.principal!.userId,
			action: "gate.toggled",
			target: "require_verified",
			payload: { require_verified: body.require_verified },
		});
		fastify.bus.emit("twodb.identity.admin.action" as never, {
			action: "gate.toggled",
			require_verified: body.require_verified,
		} as never);
		return { ok: true };
	});

	fastify.get("/admin/orgs", { preHandler: gate }, async () => {
		const db = typedDb<IdentityDB>(fastify);
		const orgs = await db
			.selectFrom("organizations")
			.select(["id", "name", "slug", "created_by", "created_at", "suspended_at"])
			.orderBy("created_at")
			.execute();
		const memberCounts = new Map<string, number>();
		const memberRows = await db
			.selectFrom("org_memberships")
			.select("org_id")
			.execute();
		for (const r of memberRows) {
			memberCounts.set(r.org_id, (memberCounts.get(r.org_id) ?? 0) + 1);
		}
		const workspaceCounts = new Map<string, number>();
		const wsRows = await db
			.selectFrom("workspaces")
			.select("org_id")
			.execute();
		for (const r of wsRows) {
			workspaceCounts.set(r.org_id, (workspaceCounts.get(r.org_id) ?? 0) + 1);
		}
		return {
			orgs: orgs.map((o) => ({
				id: o.id,
				name: o.name,
				slug: o.slug,
				createdBy: o.created_by,
				createdAt: o.created_at,
				suspendedAt: o.suspended_at,
				memberCount: memberCounts.get(o.id) ?? 0,
				workspaceCount: workspaceCounts.get(o.id) ?? 0,
			})),
		};
	});

	fastify.post(
		"/admin/orgs/:id/suspend",
		{ preHandler: gate },
		async (request, reply) => {
			const { id } = request.params as { id: string };
			const body = request.body as { suspended?: boolean };
			if (typeof body.suspended !== "boolean") {
				return reply.code(400).send({
					error: "suspended must be a boolean.",
				});
			}
			const db = typedDb<IdentityDB>(fastify);
			const org = await db
				.selectFrom("organizations")
				.select("id")
				.where("id", "=", id)
				.executeTakeFirst();
			if (!org) return reply.code(404).send({ error: "Org not found." });
			await db
				.updateTable("organizations")
				.set({ suspended_at: body.suspended ? new Date() : null })
				.where("id", "=", id)
				.execute();
			await audit(fastify, {
				actor: request.principal!.userId,
				action: body.suspended ? "org.suspended" : "org.unsuspended",
				target: id,
				payload: { suspended: body.suspended },
			});
			fastify.bus.emit("twodb.identity.org.suspended" as never, {
				orgId: id,
				suspended: body.suspended,
			} as never);
			return { ok: true };
		},
	);

	fastify.get("/admin/overview", { preHandler: gate }, async () => {
		const db = typedDb<IdentityDB>(fastify);
		const [users, orgs, workspaces, sessions] = await Promise.all([
			db.selectFrom("users").select((eb) => eb.fn.count<number>("id").as("c")).executeTakeFirst(),
			db.selectFrom("organizations").select((eb) => eb.fn.count<number>("id").as("c")).executeTakeFirst(),
			db.selectFrom("workspaces").select((eb) => eb.fn.count<number>("id").as("c")).executeTakeFirst(),
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

	fastify.get("/admin/superadmins", { preHandler: gate }, async () => {
		const db = typedDb<IdentityDB>(fastify);
		const rows = await db
			.selectFrom("platform_admins")
			.innerJoin("users", "users.id", "platform_admins.user_id")
			.select(["users.id", "users.name", "users.email", "platform_admins.granted_by", "platform_admins.created_at"])
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

	fastify.post("/admin/superadmins", { preHandler: gate }, async (request, reply) => {
		const body = request.body as { userId?: string };
		if (!body.userId) {
			return reply.code(400).send({ error: "userId is required." });
		}
		const db = typedDb<IdentityDB>(fastify);
		const user = await db
			.selectFrom("users")
			.select("id")
			.where("id", "=", body.userId)
			.executeTakeFirst();
		if (!user) return reply.code(404).send({ error: "User not found." });
		await db
			.insertInto("platform_admins")
			.values({
				user_id: body.userId,
				granted_by: request.principal!.userId,
			})
			.onConflict((oc) => oc.doNothing())
			.execute();
		await audit(fastify, {
			actor: request.principal!.userId,
			action: "superadmin.promoted",
			target: body.userId,
		});
		fastify.bus.emit("twodb.identity.superadmin.promoted" as never, {
			userId: body.userId,
		} as never);
		return { ok: true };
	});

	fastify.delete(
		"/admin/superadmins/:userId",
		{ preHandler: gate },
		async (request, reply) => {
			const { userId } = request.params as { userId: string };
			const db = typedDb<IdentityDB>(fastify);
			const count = await db
				.selectFrom("platform_admins")
				.select((eb) => eb.fn.count<number>("user_id").as("c"))
				.executeTakeFirst();
			if (Number(count?.c ?? 0) <= 1) {
				return reply.code(409).send({
					error: "Add another superadmin first.",
				});
			}
			await db
				.deleteFrom("platform_admins")
				.where("user_id", "=", userId)
				.execute();
			await audit(fastify, {
				actor: request.principal!.userId,
				action: "superadmin.demoted",
				target: userId,
			});
			fastify.bus.emit("twodb.identity.superadmin.demoted" as never, {
				userId,
			} as never);
			return { ok: true };
		},
	);
}
