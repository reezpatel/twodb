import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Claim } from "@twodb/contracts";
import { typedDb } from "@twodb/shared-backend";
import type { AuthCtx } from "../../lib/auth/ctx";
import type { IdentityDB } from "../../db/schema";
import { sharingClaimFor } from "../../lib/types";

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

export function registerPostGrants(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const withWorkspace = fastify.withWorkspace;
	const catalog = fastify.claimCatalog;
	const db = typedDb<IdentityDB>(fastify);

	fastify.post(
		"/grants",
		{
			preHandler: [withWorkspace({ workspaceIdBody: "workspaceId" })],
		},
		async (request, reply) => {
			const workspaceCtx = request.workspaceContext!;
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
					error: "entityType, entityId, userId, and claims[] are required.",
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

			const granter = request.principal!;
			const heldClaims = new Set<Claim>([shareClaim, ...claims]);
			if (
				!(await granterHolds(db, granter.userId, workspaceCtx.workspaceId, [
					...heldClaims,
				]))
			) {
				return reply.code(403).send({
					error:
						"You can only share permissions you have yourself. Ask someone with full access to share this.",
				});
			}

			const grantee = await db
				.selectFrom("workspace_members")
				.select("user_id")
				.where("workspace_id", "=", workspaceCtx.workspaceId)
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
				.where("workspace_id", "=", workspaceCtx.workspaceId)
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
						workspace_id: workspaceCtx.workspaceId,
						user_id: body.userId,
						entity_type: body.entityType,
						entity_id: body.entityId,
						claims,
						granted_by: granter.userId,
					})
					.execute();
			}
			fastify.bus.emit("twodb.identity.entity.granted", {
				workspaceId: workspaceCtx.workspaceId,
				entityType: body.entityType,
				entityId: body.entityId,
				userId: body.userId,
				claims: merged,
			});
			return reply.code(201).send({ id, claims: merged });
		},
	);
}
