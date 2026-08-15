import type { FastifyInstance } from "fastify";
import { typedDb } from "@twodb/shared-backend";
import {
	sharingClaimFor,
	type Claim,
} from "@twodb/contracts";
import { randomBytes } from "node:crypto";
import type { IdentityDB } from "./schema";

/**
 * Entity-grant APIs (task-06 §6.2).
 *   POST   /grants           — merge-or-create; emits entity.granted
 *   DELETE /grants/:id        — revoke; emits entity.revoked
 *   GET    /grants?…          — per-entity list (share dialog data)
 *
 * Privilege escalation guard (task-06 §6.3): a granter can only confer
 * claims they hold on that entity. The granter's effective claims are
 * the union of role claims + entity_grants — i.e. what the authz
 * engine (task 4) computed. We resolve that here via a one-shot
 * Postgres read so the granter's call doesn't depend on the same
 * preHandler chain the request goes through.
 */
export function registerGrantRoutes(fastify: FastifyInstance) {
	const withWorkspace = fastify.withWorkspace;
	const requireClaim = fastify.requireClaim;
	const catalog = fastify.claimCatalog;

	async function granterHolds(
		db: ReturnType<typeof typedDb<IdentityDB>>,
		userId: string,
		workspaceId: string,
		claims: Claim[],
	): Promise<boolean> {
		if (claims.length === 0) return true;
		const rows = await db
			.selectFrom("workspace_role_assignments")
			.innerJoin(
				"role_claims",
				"role_claims.role_id",
				"workspace_role_assignments.role_id",
			)
			.select("role_claims.claim")
			.where("workspace_role_assignments.workspace_id", "=", workspaceId)
			.where("workspace_role_assignments.user_id", "=", userId)
			.execute();
		const held = new Set<string>(rows.map((r) => r.claim));
		for (const grant of await db
			.selectFrom("entity_grants")
			.select(["claims"])
			.where("workspace_id", "=", workspaceId)
			.where("user_id", "=", userId)
			.execute()) {
			for (const c of grant.claims) held.add(c);
		}
		return claims.every((c) => held.has(c));
	}

	fastify.post(
		"/grants",
		{
			preHandler: [
				withWorkspace({ workspaceIdBody: "workspaceId" }),
			],
		},
		async (request, reply) => {
			const ctx = request.workspaceContext!;
			const body = request.body as {
				entityType?: string;
				entityId?: string;
				userId?: string;
				claims?: string[];
			};
			if (
				!body.entityType ||
				!body.entityId ||
				!body.userId ||
				!Array.isArray(body.claims) ||
				body.claims.length === 0
			) {
				return reply.code(400).send({
					error:
						"entityType, entityId, userId, and claims[] are required.",
				});
			}
			const claims = body.claims as Claim[];
			for (const c of claims) {
				if (!catalog.all.has(c)) {
					return reply.code(400).send({ error: `Unknown claim "${c}".` });
				}
				if (c.startsWith("app.")) {
					return reply.code(400).send({
						error: "App claims belong to app grants, not entity grants.",
					});
				}
			}
			const shareClaim = sharingClaimFor(body.entityType);
			if (!shareClaim) {
				return reply.code(400).send({
					error: `Entity type "${body.entityType}" has no sharing claim registered.`,
				});
			}

			const db = typedDb<IdentityDB>(request.server);
			const granter = request.principal!;
			const heldClaims = new Set<Claim>([shareClaim, ...claims]);
			if (!(await granterHolds(db, granter.userId, ctx.workspaceId, [...heldClaims]))) {
				return reply.code(403).send({
					error:
						"You can only share permissions you have yourself. Ask someone with full access to share this.",
				});
			}

			const grantee = await db
				.selectFrom("workspace_members")
				.select("user_id")
				.where("workspace_id", "=", ctx.workspaceId)
				.where("user_id", "=", body.userId)
				.executeTakeFirst();
			if (!grantee) {
				return reply
					.code(403)
					.send({ error: "That user is not a member of this workspace." });
			}

			const existing = await db
				.selectFrom("entity_grants")
				.select(["id", "claims"])
				.where("workspace_id", "=", ctx.workspaceId)
				.where("entity_type", "=", body.entityType)
				.where("entity_id", "=", body.entityId)
				.where("user_id", "=", body.userId)
				.executeTakeFirst();

			let id: string;
			let merged: string[];
			if (existing) {
				id = existing.id;
				merged = Array.from(new Set([...existing.claims, ...claims]));
				await db
					.updateTable("entity_grants")
					.set({
						claims: merged,
						granted_by: granter.userId,
					})
					.where("id", "=", id)
					.execute();
			} else {
				id = `grt-${randomBytes(8).toString("base64url")}`;
				merged = claims as string[];
				await db
					.insertInto("entity_grants")
					.values({
						id,
						workspace_id: ctx.workspaceId,
						user_id: body.userId,
						entity_type: body.entityType,
						entity_id: body.entityId,
						claims,
						granted_by: granter.userId,
					})
					.execute();
			}
			fastify.bus.emit("twodb.identity.entity.granted", {
				workspaceId: ctx.workspaceId,
				entityType: body.entityType,
				entityId: body.entityId,
				userId: body.userId,
				claims: merged,
			});
			return reply.code(201).send({ id, claims: merged });
		},
	);

	fastify.delete(
		"/grants/:id",
		{
			preHandler: [
				withWorkspace({ workspaceIdBody: "workspaceId" }),
				requireClaim("plugin.twodb.identity:role.manage"),
			],
		},
		async (request, reply) => {
			const ctx = request.workspaceContext!;
			const { id } = request.params as { id: string };
			const db = typedDb<IdentityDB>(request.server);
			const target = await db
				.selectFrom("entity_grants")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirst();
			if (!target) {
				return reply.code(404).send({ error: "Grant not found." });
			}
			if (target.workspace_id !== ctx.workspaceId) {
				return reply
					.code(403)
					.send({ error: "Grant belongs to a different workspace." });
			}
			await db.deleteFrom("entity_grants").where("id", "=", id).execute();
			fastify.bus.emit("twodb.identity.entity.revoked", {
				workspaceId: target.workspace_id,
				entityType: target.entity_type,
				entityId: target.entity_id,
				userId: target.user_id,
			});
			return { ok: true };
		},
	);

	fastify.get(
		"/grants",
		{
			preHandler: [
				withWorkspace({ workspaceIdQuery: "workspaceId" }),
			],
		},
		async (request, reply) => {
			const ctx = request.workspaceContext!;
			const { entityType, entityId } = request.query as {
				entityType?: string;
				entityId?: string;
			};
			if (!entityType || !entityId) {
				return reply.code(400).send({
					error: "entityType and entityId query params are required.",
				});
			}
			const db = typedDb<IdentityDB>(request.server);
			const rows = await db
				.selectFrom("entity_grants")
				.innerJoin("users", "users.id", "entity_grants.user_id")
				.select([
					"entity_grants.id",
					"entity_grants.user_id",
					"entity_grants.claims",
					"entity_grants.granted_by",
					"entity_grants.created_at",
					"users.name",
					"users.email",
				])
				.where("entity_grants.workspace_id", "=", ctx.workspaceId)
				.where("entity_grants.entity_type", "=", entityType)
				.where("entity_grants.entity_id", "=", entityId)
				.execute();
			return {
				grants: rows.map((r) => ({
					id: r.id,
					user: {
						id: r.user_id,
						name: r.name,
						email: r.email,
					},
					claims: r.claims,
					grantedBy: r.granted_by,
					createdAt: r.created_at,
				})),
			};
		},
	);
}
