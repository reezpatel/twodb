import type { Claim, Principal } from "@twodb/contracts";
import type { ClaimCatalog } from "./catalog";

export type { Principal } from "@twodb/contracts";

declare module "fastify" {
	interface FastifyInstance {
		claimCatalog: ClaimCatalog;
		requireClaim: ReturnType<typeof import("./requireClaim").makeRequireClaim>;
		requireAppClaim: ReturnType<
			typeof import("./requireAppClaim").makeRequireAppClaim
		>;
		withWorkspace: ReturnType<
			typeof import("./withWorkspace").makeWithWorkspace
		>;
	}
	interface FastifyRequest {
		principal: Principal | null;
		workspaceContext: {
			workspaceId: string;
			roleClaims: ReadonlySet<Claim>;
			isMember: boolean;
		} | null;
		claims: Set<Claim>;
	}
}

export {
	buildClaimCatalog,
	claimOwner,
	danglingClaims,
	type ClaimCatalog,
} from "./catalog";
export {
	makeWithWorkspace,
	type WithWorkspaceOpts,
	type WithWorkspaceSource,
} from "./withWorkspace";
export { makeRequireClaim, type RequireClaimOpts } from "./requireClaim";
export {
	makeRequireAppClaim,
	type RequireAppClaimOpts,
} from "./requireAppClaim";
