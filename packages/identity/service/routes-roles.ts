import type { FastifyInstance } from "fastify";
import { typedDb } from "@twodb/shared-backend";
import type { Claim } from "@twodb/contracts";
import type { IdentityDB } from "./schema";
import { isSystemRoleKey, slugifyRoleKey } from "./roles";

/**
 * Role CRUD for a workspace (task-05 §5.4).
 *   GET  /workspaces/:id/roles   — list system + custom with claims & catalog
 *   POST /workspaces/:id/roles   — create a custom role from the catalog
 * PATCH/DELETE/clone land later.
 */
export function registerRoleRoutes(fastify: FastifyInstance) {
	const requireClaim = fastify.requireClaim;
	const withWorkspace = fastify.withWorkspace;
	const catalog = fastify.claimCatalog;

	fastify.get(
		"/workspaces/:id/roles",
		{
			preHandler: [withWorkspace({ entity: "workspaces", idParam: "id" })],
		},
		async (request, reply) => {
			const ctx = request.workspaceContext;
			if (!ctx?.isMember) {
				return reply
					.code(403)
					.send({ error: "You are not in this workspace." });
			}
			const db = typedDb<IdentityDB>(request.server);
			const rows = await db
				.selectFrom("roles")
				.select(["id", "key", "name", "description", "is_system"])
				.where("workspace_id", "=", ctx.workspaceId)
				.orderBy("is_system")
				.orderBy("name")
				.execute();

			const claimRows = await db
				.selectFrom("role_claims")
				.innerJoin("roles", "roles.id", "role_claims.role_id")
				.select(["role_claims.role_id", "role_claims.claim"])
				.where("roles.workspace_id", "=", ctx.workspaceId)
				.execute();
			const claimsByRole = new Map<string, string[]>();
			for (const c of claimRows) {
				const list = claimsByRole.get(c.role_id) ?? [];
				list.push(c.claim);
				claimsByRole.set(c.role_id, list);
			}

			return {
				roles: rows.map((r) => ({
					id: r.id,
					key: r.key,
					name: r.name,
					description: r.description,
					isSystem: r.is_system,
					claims: (claimsByRole.get(r.id) ?? []).map((c) => ({
						claim: c,
						dangling: !catalog.all.has(c as Claim),
					})),
				})),
				catalog: Array.from(catalog.all),
			};
		},
	);

	fastify.post(
		"/workspaces/:id/roles",
		{
			preHandler: [
				withWorkspace({ entity: "workspaces", idParam: "id" }),
				requireClaim("plugin.twodb.identity:role.manage"),
			],
		},
		async (request, reply) => {
			const ctx = request.workspaceContext;
			const body = request.body as {
				name?: string;
				description?: string;
				claims?: string[];
			};
			if (!body.name?.trim()) {
				return reply.code(400).send({ error: "name is required." });
			}
			const candidateKey = slugifyRoleKey(body.name);
			if (isSystemRoleKey(candidateKey)) {
				return reply.code(409).send({
					error: `Role key "${candidateKey}" is reserved for a system role. Clone the system role instead.`,
				});
			}
			const claims = body.claims ?? [];
			for (const c of claims) {
				if (!catalog.all.has(c as Claim)) {
					return reply.code(400).send({ error: `Unknown claim "${c}".` });
				}
				if (c.startsWith("app.")) {
					return reply.code(400).send({
						error: "app.* claims belong to app roles, not workspace roles.",
					});
				}
			}
			const id = `rol-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
			const db = typedDb<IdentityDB>(request.server);
			try {
				await db.transaction().execute(async (trx) => {
					const existing = await trx
						.selectFrom("roles")
						.select("id")
						.where("workspace_id", "=", ctx!.workspaceId)
						.where("key", "=", candidateKey)
						.executeTakeFirst();
					if (existing) {
						throw new Error("DUPLICATE_KEY");
					}
					await trx
						.insertInto("roles")
						.values({
							id,
							workspace_id: ctx!.workspaceId,
							key: candidateKey,
							name: body.name!.trim(),
							description: body.description ?? null,
							is_system: false,
						})
						.execute();
					for (const c of claims) {
						await trx
							.insertInto("role_claims")
							.values({ role_id: id, claim: c })
							.execute();
					}
				});
			} catch (err) {
				if (err instanceof Error && err.message === "DUPLICATE_KEY") {
					return reply.code(409).send({
						error: `A role with key "${candidateKey}" already exists in this workspace.`,
					});
				}
				throw err;
			}
			return reply.code(201).send({ id, key: candidateKey });
		},
	);
}
