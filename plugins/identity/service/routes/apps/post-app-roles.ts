import { identityDb } from "../../db";
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";

import type { AuthCtx } from "../../lib/auth/ctx";
import { requireAppAdmin } from "./shared";

export function registerPostAppRoles(
	fastify: FastifyInstance,
	_ctx: AuthCtx,
): void {
	const db = identityDb(fastify);

	fastify.post("/apps/:appId/roles", async (request, reply) => {
		const { appId } = request.params as { appId: string };
		const gate = await requireAppAdmin(appId, request);
		if (!gate.ok) return reply.code(gate.status).send(gate.body);
		const body = request.body as { name?: string; claims?: string[] };
		if (!body.name?.trim() || !Array.isArray(body.claims)) {
			return reply.code(400).send({ error: "name and claims[] are required." });
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
	});
}
