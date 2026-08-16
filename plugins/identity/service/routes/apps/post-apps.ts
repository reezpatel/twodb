import { identityDb } from "../../db";
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Claim } from "@twodb/contracts";

import type { AuthCtx } from "../../lib/auth/ctx";
import type { PluginManifest } from "../../lib/types";
import { seedAppRoles } from "../../lib/apps/apps";

export function registerPostApps(
	fastify: FastifyInstance,
	_ctx: AuthCtx,
): void {
	const db = identityDb(fastify);

	fastify.post(
		"/apps",
		{
			preHandler: [
				fastify.identityRequireClaim("plugin.twodb.identity:app.manage"),
			],
		},
		async (request, reply) => {
			const principal = request.principal!;
			const workspaceId = principal.workspaceId;
			if (!workspaceId || !principal.isWorkspaceMember) {
				return reply
					.code(403)
					.send({ error: "You are not in this workspace." });
			}
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
			try {
				await db
					.insertInto("apps")
					.values({
						id,
						workspace_id: workspaceId,
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
			for (const c of permissions) fastify.identityClaimCatalog.all.add(c);
			fastify.bus.emit("twodb.identity.app.created", {
				appId: id,
				workspaceId,
			});
			return reply.code(201).send({ id, slug: body.slug });
		},
	);
}
