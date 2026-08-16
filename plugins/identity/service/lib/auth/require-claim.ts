import type {
	FastifyInstance,
	FastifyRequest,
	preHandlerHookHandler,
} from "fastify";
import type { Claim } from "@twodb/contracts";
import type { IdentityClaimCatalog } from "./claims-catalog";

export function makeRequireClaim(catalog: IdentityClaimCatalog) {
	return function requireClaim(claim: Claim): preHandlerHookHandler {
		if (!catalog.all.has(claim)) {
			throw new Error(
				`twodb: claim "${claim}" is not declared in the claim catalog.`,
			);
		}
		if (claim.startsWith("app.")) {
			throw new Error(
				`twodb: claim "${claim}" is app-scoped — use requireAppClaim instead.`,
			);
		}
		return async (request: FastifyRequest, reply) => {
			const principal = request.principal as
				| { userId: string; claims: string[] }
				| null
				| undefined;
			if (!principal || !principal.claims.includes(claim)) {
				reply.code(403).send({
					error: humanize(claim),
				});
			}
		};
	};
}

function humanize(claim: Claim): string {
	const colon = claim.indexOf(":");
	const nounPart = claim.slice(colon + 1);
	const dot = nounPart.lastIndexOf(".");
	const noun = dot === -1 ? nounPart : nounPart.slice(0, dot);
	const verb = dot === -1 ? "access" : nounPart.slice(dot + 1);
	return `You don't have permission to ${verb} this ${noun}.`;
}

export function makeRequireAppClaim(catalog: IdentityClaimCatalog) {
	return function requireAppClaim(claim: Claim): preHandlerHookHandler {
		if (!catalog.all.has(claim)) {
			throw new Error(
				`twodb: claim "${claim}" is not declared in the claim catalog.`,
			);
		}
		if (claim.startsWith("plugin.")) {
			throw new Error(
				`twodb: claim "${claim}" is plugin-scoped — use requireClaim instead.`,
			);
		}
		return async (_request: FastifyRequest, reply) => {
			reply.code(403).send({
				error:
					"App claims are not yet enforced — apps + app roles land in task 7.",
			});
		};
	};
}

export function decorateAuthz(
	fastify: FastifyInstance,
	catalog: IdentityClaimCatalog,
): void {
	fastify.decorate("identityClaimCatalog", catalog);
	fastify.decorate("identityRequireClaim", makeRequireClaim(catalog));
	fastify.decorate("identityRequireAppClaim", makeRequireAppClaim(catalog));
}

declare module "fastify" {
	interface FastifyInstance {
		identityClaimCatalog: IdentityClaimCatalog;
		identityRequireClaim: ReturnType<typeof makeRequireClaim>;
		identityRequireAppClaim: ReturnType<typeof makeRequireAppClaim>;
	}
}
