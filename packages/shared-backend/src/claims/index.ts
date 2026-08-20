import type { Claim, Principal } from "@twodb/contracts";
import type { ClaimCatalog } from "./catalog";

export type { Principal } from "@twodb/contracts";

declare module "fastify" {
	interface FastifyInstance {
		claimCatalog: ClaimCatalog;
		requireClaim: ReturnType<typeof import("./require-claim").makeRequireClaim>;
		requireAppClaim: ReturnType<
			typeof import("./require-app-claim").makeRequireAppClaim
		>;
		withWorkspace: ReturnType<
			typeof import("./with-workspace").makeWithWorkspace
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
} from "./with-workspace";
export { makeRequireClaim, type RequireClaimOpts } from "./require-claim";
export {
	makeRequireAppClaim,
	type RequireAppClaimOpts,
} from "./require-app-claim";
