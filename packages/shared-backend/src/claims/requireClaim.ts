import type { TwodbFastifyInstance } from "@twodb/contracts";
import type { preHandlerHookHandler } from "fastify";
import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { Claim } from "@twodb/contracts";
import type { ClaimCatalog } from "./catalog";
import type { IdentityDB } from "@twodb/identity/schema";

export type RequireClaimOpts = {
	entity?: string;
	idParam?: string;
};

const ENTITY_GRANT_CACHE = Symbol("twodb.entityGrantCache");

declare module "fastify" {
	interface FastifyRequest {
		[ENTITY_GRANT_CACHE]?: Map<string, Set<Claim>>;
	}
}

export function makeRequireClaim(catalog: ClaimCatalog) {
	return function requireClaim(
		claim: Claim,
		opts: RequireClaimOpts = {},
	): preHandlerHookHandler {
		if (!catalog.all.has(claim)) {
			throw new Error(
				`twodb: claim "${claim}" is not declared in the claim catalog. ` +
					`Add it to a plugin's manifest.permissions and reload.`,
			);
		}
		const isAppScoped = claim.startsWith("app.");
		if (isAppScoped) {
			throw new Error(
				`twodb: claim "${claim}" is app-scoped — use requireAppClaim instead.`,
			);
		}
		return async (request, reply) => {
			if (opts.entity && opts.idParam) {
				await unionEntityGrants(request, opts.entity, opts.idParam);
			}
			if (request.claims.has(claim)) return;
			reply.code(403).send({
				error: humanize(claim, opts.entity !== undefined),
			});
		};
	};
}

async function unionEntityGrants(
	request: import("fastify").FastifyRequest,
	entity: string,
	idParam: string,
): Promise<void> {
	const ctx = request.workspaceContext;
	const principal = request.principal;
	if (!ctx?.workspaceId || !principal) {
		request.claims = new Set(request.claims);
		return;
	}
	const entityId = (request.params as Record<string, unknown>)[idParam];
	if (typeof entityId !== "string") return;

	const cacheKey = `${ctx.workspaceId}:${principal.userId}:${entity}:${entityId}`;
	const cache = (request[ENTITY_GRANT_CACHE] ??= new Map<string, Set<Claim>>());
	const hit = cache.get(cacheKey);
	if (hit) {
		for (const c of hit) request.claims.add(c);
		return;
	}

	const db = (request.server as unknown as { db: Kysely<IdentityDB> }).db;
	const rows = await sql<{ claims: string[] }>`
		SELECT claims
		FROM entity_grants
		WHERE workspace_id = ${ctx.workspaceId}
		  AND user_id = ${principal.userId}
		  AND entity_type = ${entity}
		  AND entity_id = ${entityId}
	`.execute(db as unknown as Kysely<{ claims: string[] }>);
	const granted = new Set<Claim>(
		(rows.rows[0]?.claims ?? []) as unknown as Claim[],
	);
	cache.set(cacheKey, granted);
	for (const c of granted) request.claims.add(c);
}

function humanize(claim: Claim, isEntity: boolean): string {
	const colon = claim.indexOf(":");
	const nounPart = claim.slice(colon + 1);
	const dot = nounPart.lastIndexOf(".");
	const noun = dot === -1 ? nounPart : nounPart.slice(0, dot);
	const verb = dot === -1 ? "access" : nounPart.slice(dot + 1);
	const article = /^[aeiou]/i.test(noun) ? "an" : "a";
	return isEntity
		? `You don't have permission to ${verb} this ${noun}.`
		: `You don't have permission to ${verb} ${article} ${noun}.`;
}
