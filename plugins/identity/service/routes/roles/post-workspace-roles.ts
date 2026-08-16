import type { FastifyInstance } from "fastify";
import type { Claim } from "@twodb/contracts";
import { typedDb } from "@twodb/shared-backend";
import type { AuthCtx } from "../../lib/auth/ctx";
import type { IdentityDB } from "../../db/schema";
import { isSystemRoleKey, slugifyRoleKey } from "../../lib/roles/roles";

export function registerPostWorkspaceRoles(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const requireClaim = fastify.requireClaim;
	const withWorkspace = fastify.withWorkspace;
	const catalog = fastify.claimCatalog;
	const db = typedDb<IdentityDB>(fastify);

	fastify.post(
		"/workspaces/:id/roles",
		{
			preHandler: [
				withWorkspace({ entity: "workspaces", idParam: "id" }),
				requireClaim("plugin.twodb.identity:role.manage"),
			],
		},
		async (request, reply) => {
			const workspaceCtx = request.workspaceContext;
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
			try {
				await db.transaction().execute(async (trx) => {
					const existing = await trx
						.selectFrom("roles")
						.select("id")
						.where("workspace_id", "=", workspaceCtx!.workspaceId)
						.where("key", "=", candidateKey)
						.executeTakeFirst();
					if (existing) {
						throw new Error("DUPLICATE_KEY");
					}
					await trx
						.insertInto("roles")
						.values({
							id,
							workspace_id: workspaceCtx!.workspaceId,
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
