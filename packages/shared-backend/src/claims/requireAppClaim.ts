import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { Claim } from "@twodb/contracts";
import type { ClaimCatalog } from "./catalog";
import type { IdentityDB } from "@twodb/plugin-identity/schema";

export type RequireAppClaimOpts = {
	appIdParam?: string;
	appIdBody?: string;
};

export function makeRequireAppClaim(catalog: ClaimCatalog) {
	return function requireAppClaim(
		claim: Claim,
		_opts: RequireAppClaimOpts = {},
	): preHandlerHookHandler {
		if (!catalog.all.has(claim)) {
			throw new Error(
				`twodb: claim "${claim}" is not declared in the claim catalog. ` +
					`Add it to a plugin's manifest.permissions and reload.`,
			);
		}
		if (claim.startsWith("plugin.")) {
			throw new Error(
				`twodb: claim "${claim}" is plugin-scoped — use requireClaim instead.`,
			);
		}

		// App tables (apps, app_roles, app_role_claims, app_role_assignments)
		// arrive in task 7; until then, the route is registered but every
		// request fails the check with 403 — strict before storage.
		return async (_request, reply) => {
			reply.code(403).send({
				error:
					"App claims are not yet enforced — apps + app roles land in task 7.",
			});
		};
	};
}
