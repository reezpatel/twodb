import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { typedDb, newId } from "@twodb/shared-backend";
import type {
	Claim,
	PluginManifest,
} from "@twodb/contracts";
import {
	effectiveAppClaims,
	seedAppRoles,
} from "./apps";
import type { IdentityDB } from "./schema";

/**
 * App APIs (task-07 §7.6 + §7.3).
 *
 *  Two distinct gates:
 *  - requireAppClaim(claim)    → resolved-app effective-claim check
 *                                  (catalog assertion + role grants)
 *  - requireAppAdmin()         → implicit-app-owner check
 *                                  (workspace owner/manager → app-owner)
 *  The first gates "this user can do X in the app", the second gates
 *  "this user can manage the app's roles and assignments" per task-07
 *  §7.6 (\"implicit or assigned app-owner on the target app\").
 */
export function registerAppRoutes(fastify: FastifyInstance) {
	const requireAppClaim = fastify.requireAppClaim;
	const withWorkspace = fastify.withWorkspace;

	async function loadAppOr404(appId: string) {
		const db = typedDb<IdentityDB>(fastify);
		const row = await db
			.selectFrom("apps")
			.select(["id", "workspace_id", "slug", "manifest"])
			.where("id", "=", appId)
			.executeTakeFirst();
		if (!row) return null;
		return {
			id: row.id,
			workspace_id: row.workspace_id,
			slug: row.slug,
			permissions: ((row.manifest as { permissions: Claim[] }) ?? [])
				.permissions ?? [],
			roleDefaults: ((row.manifest as { roleDefaults?: PluginManifest["roleDefaults"] })
				?.roleDefaults) ?? {},
		};
	}

	async function requireAppAdmin(
		appId: string,
		request: import("fastify").FastifyRequest,
	): Promise<
		| { ok: true; app: NonNullable<Awaited<ReturnType<typeof loadAppOr404>>> }
		| { ok: false; status: number; body: { error: string } }
	> {
		const principal = request.principal;
		const app = await loadAppOr404(appId);
		if (!app) return { ok: false, status: 404, body: { error: "App not found." } };
		if (!principal?.userId) {
			return { ok: false, status: 401, body: { error: "Sign in to continue." } };
		}
		const db = typedDb<IdentityDB>(request.server);
		const held = await effectiveAppClaims(
			db,
			principal.userId,
			appId,
			app.workspace_id,
			app.permissions,
		);
		const allPermissions = app.permissions.length === held.size;
		if (!allPermissions) {
			return {
				ok: false,
				status: 403,
				body: { error: "You're not an admin of this app." },
			};
		}
		return { ok: true, app };
	}

	fastify.post(
		"/apps",
		{
			preHandler: [
				withWorkspace({ workspaceIdBody: "workspaceId" }),
				fastify.requireClaim("plugin.twodb.identity:app.manage"),
			],
		},
		async (request, reply) => {
			const ctx = request.workspaceContext!;
			const body = request.body as {
				slug?: string;
				name?: string;
				manifest?: {
					permissions?: readonly Claim[];
					roleDefaults?: PluginManifest["roleDefaults"];
				};
			};
			if (!body.slug || !body.name || !body.manifest) {
				return reply
					.code(400)
					.send({ error: "slug, name, and manifest are required." });
			}
			const permissions = body.manifest.permissions ?? [];
			const roleDefaults = body.manifest.roleDefaults ?? {};
			if (permissions.length === 0) {
				return reply.code(400).send({
					error: "manifest.permissions must declare at least one claim.",
				});
			}
			for (const c of permissions) {
				if (!c.startsWith("app.")) {
					return reply.code(400).send({
						error: `Claim "${c}" is not an app.* claim.`,
					});
				}
			}
			const id = `app-${randomBytes(8).toString("base64url")}`;
			const db = typedDb<IdentityDB>(request.server);
			try {
				await db
					.insertInto("apps")
					.values({
						id,
						workspace_id: ctx.workspaceId,
						slug: body.slug.trim(),
						name: body.name.trim(),
						manifest: {
							permissions,
							roleDefaults,
						},
					})
					.execute();
			} catch (err) {
				if ((err as { code?: string }).code === "23505") {
					return reply.code(409).send({
						error: `App slug "${body.slug}" is taken in this workspace.`,
					});
				}
				throw err;
			}
			await seedAppRoles(db, id, permissions, roleDefaults);
			for (const c of permissions) fastify.claimCatalog.all.add(c);
			fastify.bus.emit("twodb.identity.app.created", {
				appId: id,
				workspaceId: ctx.workspaceId,
			});
			return reply.code(201).send({ id, slug: body.slug });
		},
	);

	fastify.get(
		"/apps/:appId/roles",
		{
			preHandler: [
				withWorkspace({
					entity: "apps",
					idParam: "appId",
					workspaceField: "workspace_id",
				}),
			],
		},
		async (request, reply) => {
			const { appId } = request.params as { appId: string };
			const gate = await requireAppAdmin(appId, request);
			if (!gate.ok) return reply.code(gate.status).send(gate.body);
			const db = typedDb<IdentityDB>(request.server);
			const roles = await db
				.selectFrom("app_roles")
				.select(["id", "key", "name", "is_system"])
				.where("app_id", "=", appId)
				.orderBy("is_system", "desc")
				.orderBy("name")
				.execute();
			const claimsRows = await db
				.selectFrom("app_role_claims")
				.innerJoin("app_roles", "app_roles.id", "app_role_claims.app_role_id")
				.select(["app_role_claims.app_role_id", "app_role_claims.claim"])
				.where("app_roles.app_id", "=", appId)
				.execute();
			const grouped = new Map<string, string[]>();
			for (const c of claimsRows) {
				const list = grouped.get(c.app_role_id) ?? [];
				list.push(c.claim);
				grouped.set(c.app_role_id, list);
			}
			return {
				roles: roles.map((r) => ({
					id: r.id,
					key: r.key,
					name: r.name,
					isSystem: r.is_system,
					claims: grouped.get(r.id) ?? [],
				})),
				catalog: gate.app.permissions,
			};
		},
	);

	fastify.post(
		"/apps/:appId/roles",
		{
			preHandler: [
				withWorkspace({
					entity: "apps",
					idParam: "appId",
					workspaceField: "workspace_id",
				}),
			],
		},
		async (request, reply) => {
			const { appId } = request.params as { appId: string };
			const gate = await requireAppAdmin(appId, request);
			if (!gate.ok) return reply.code(gate.status).send(gate.body);
			const body = request.body as { name?: string; claims?: string[] };
			if (!body.name?.trim() || !Array.isArray(body.claims)) {
				return reply
					.code(400)
					.send({ error: "name and claims[] are required." });
			}
			const appPerms = new Set<string>(gate.app.permissions);
			for (const c of body.claims) {
				if (!appPerms.has(c)) {
					return reply.code(400).send({
						error: `Claim "${c}" is not in this app's claim set.`,
					});
				}
				if (!c.startsWith("app.")) {
					return reply.code(400).send({
						error: "App roles can only hold app.* claims.",
					});
				}
			}
			const id = `aro-${randomBytes(8).toString("base64url")}`;
			const db = typedDb<IdentityDB>(request.server);
			await db
				.insertInto("app_roles")
				.values({
					id,
					app_id: appId,
					key: `custom_${id.slice(4, 12)}`,
					name: body.name.trim(),
					description: null,
					is_system: false,
				})
				.execute();
			for (const c of body.claims) {
				await db
					.insertInto("app_role_claims")
					.values({ app_role_id: id, claim: c })
					.execute();
			}
			return reply.code(201).send({ id, name: body.name });
		},
	);

	fastify.post(
		"/apps/:appId/assignments",
		{
			preHandler: [
				withWorkspace({
					entity: "apps",
					idParam: "appId",
					workspaceField: "workspace_id",
				}),
			],
		},
		async (request, reply) => {
			const { appId } = request.params as { appId: string };
			const gate = await requireAppAdmin(appId, request);
			if (!gate.ok) return reply.code(gate.status).send(gate.body);
			const body = request.body as { userId?: string; appRoleId?: string };
			if (!body.userId || !body.appRoleId) {
				return reply
					.code(400)
					.send({ error: "userId and appRoleId are required." });
			}
			const db = typedDb<IdentityDB>(request.server);
			const role = await db
				.selectFrom("app_roles")
				.select("id")
				.where("id", "=", body.appRoleId)
				.where("app_id", "=", appId)
				.executeTakeFirst();
			if (!role) {
				return reply
					.code(404)
					.send({ error: "App role not found in this app." });
			}
			const assignmentId = newId("ara");
			try {
				await db
					.insertInto("app_role_assignments")
					.values({
						id: assignmentId,
						app_id: appId,
						user_id: body.userId,
						app_role_id: body.appRoleId,
					})
					.execute();
			} catch (err) {
				if ((err as { code?: string }).code === "23505") {
					return reply
						.code(409)
						.send({ error: "User already holds that role in this app." });
				}
				throw err;
			}
			fastify.bus.emit("twodb.identity.app.role.assigned", {
				appId,
				userId: body.userId,
				appRoleId: body.appRoleId,
			});
			return reply.code(201).send({ assignmentId });
		},
	);

	fastify.delete(
		"/apps/:appId/assignments/:assignmentId",
		{
			preHandler: [
				withWorkspace({
					entity: "apps",
					idParam: "appId",
					workspaceField: "workspace_id",
				}),
			],
		},
		async (request, reply) => {
			const { appId, assignmentId } = request.params as {
				appId: string;
				assignmentId: string;
			};
			const gate = await requireAppAdmin(appId, request);
			if (!gate.ok) return reply.code(gate.status).send(gate.body);
			const db = typedDb<IdentityDB>(request.server);
			const target = await db
				.selectFrom("app_role_assignments")
				.select(["user_id", "app_role_id"])
				.where("id", "=", assignmentId)
				.where("app_id", "=", appId)
				.executeTakeFirst();
			if (!target) {
				return reply.code(404).send({ error: "Assignment not found." });
			}
			await db
				.deleteFrom("app_role_assignments")
				.where("id", "=", assignmentId)
				.execute();
			fastify.bus.emit("twodb.identity.app.role.revoked", {
				appId,
				userId: target.user_id,
				appRoleId: target.app_role_id,
			});
			return { ok: true };
		},
	);

	// Mark requireAppClaim as used (registered above for future dogfood routes).
	void requireAppClaim;
}
