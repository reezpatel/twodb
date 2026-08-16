import { identityDb } from "../../db";
import type { FastifyInstance, FastifyRequest } from "fastify";

import type { Claim } from "@twodb/contracts";
import type { Principal } from "../../lib/types";
import { effectiveAppClaims } from "../../lib/apps/apps";

export async function loadAppOr404(fastify: FastifyInstance, appId: string) {
	const db = identityDb(fastify);
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
		permissions:
			((row.manifest as { permissions: Claim[] }) ?? []).permissions ?? [],
		roleDefaults:
			(row.manifest as { roleDefaults?: Record<string, readonly Claim[]> })
				?.roleDefaults ?? {},
	};
}

export async function requireAppAdmin(
	appId: string,
	request: FastifyRequest,
): Promise<
	| { ok: true; app: NonNullable<Awaited<ReturnType<typeof loadAppOr404>>> }
	| { ok: false; status: number; body: { error: string } }
> {
	const principal = request.principal as Principal | null;
	const app = await loadAppOr404(request.server, appId);
	if (!app)
		return { ok: false, status: 404, body: { error: "App not found." } };
	if (!principal?.userId) {
		return {
			ok: false,
			status: 401,
			body: { error: "Sign in to continue." },
		};
	}
	if (app.workspace_id !== principal.workspaceId) {
		return {
			ok: false,
			status: 403,
			body: { error: "App does not belong to the active workspace." },
		};
	}
	const db = identityDb(request.server);
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
