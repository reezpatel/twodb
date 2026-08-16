import { identityDb } from "../../db";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { Claim } from "@twodb/contracts";
import { SESSION_COOKIE } from "../../../shared/constants";
import type { Principal } from "../types";

import type { IdentifierMode, IdentityDB } from "../../db/schema";
import { userVerified } from "../users/methods";
import { resolveSession } from "./sessions";

declare module "fastify" {
	interface FastifyRequest {
		principal: Principal | null;
	}
}

type WorkspaceContext = {
	workspaceId: string;
	roleClaims: ReadonlySet<Claim>;
	isMember: boolean;
};

async function resolveWorkspaceContext(
	db: ReturnType<typeof identityDb>,
	userId: string,
	workspaceId: string,
): Promise<{ isWorkspaceMember: boolean; claims: string[] }> {
	const member = await db
		.selectFrom("workspace_members")
		.select("user_id")
		.where("workspace_id", "=", workspaceId)
		.where("user_id", "=", userId)
		.executeTakeFirst();
	const isWorkspaceMember = member !== undefined;
	let claims: string[] = [];
	if (isWorkspaceMember) {
		const claimRows = await db
			.selectFrom("workspace_role_assignments")
			.innerJoin(
				"role_claims",
				"role_claims.role_id",
				"workspace_role_assignments.role_id",
			)
			.select("role_claims.claim")
			.where("workspace_role_assignments.workspace_id", "=", workspaceId)
			.where("workspace_role_assignments.user_id", "=", userId)
			.execute();
		claims = claimRows.map((r) => r.claim);
	}
	return { isWorkspaceMember, claims };
}

export const identityAuthPlugin = fp(
	async (fastify: FastifyInstance) => {
		const config = (
			fastify as unknown as {
				config: {
					TWODB_IDENTIFIER: IdentifierMode;
					TWODB_REQUIRE_VERIFIED: boolean;
				};
			}
		).config;
		fastify.decorateRequest("principal", null);
		fastify.addHook("onRequest", async (request, reply) => {
			const token = request.cookies[SESSION_COOKIE];
			request.principal = token
				? await resolveSession(identityDb(fastify), token)
				: null;

			request.claims = new Set<Claim>();
			request.workspaceContext = null;

			if (request.principal) {
				const workspaceId = request.headers["x-workspace-id"];
				if (typeof workspaceId === "string") {
					const db = identityDb(fastify);
					const { isWorkspaceMember, claims } = await resolveWorkspaceContext(
						db,
						request.principal.userId,
						workspaceId,
					);
					request.principal = {
						...request.principal,
						workspaceId,
						claims,
						isWorkspaceMember,
					};
					request.workspaceContext = {
						workspaceId,
						roleClaims: new Set(claims as Claim[]),
						isMember: isWorkspaceMember,
					} as WorkspaceContext;
					request.claims = new Set(claims as Claim[]);
				}
			}

			const isApiRoute = request.url.startsWith("/api/v1/");
			if (isApiRoute) {
				request.log.info(
					{ principal: request.principal?.userId ?? null },
					"principal resolved",
				);
			}

			const routeConfig = request.routeOptions.config as {
				public?: boolean;
				verifyExempt?: boolean;
			};
			if (isApiRoute && routeConfig.public !== true && !request.principal) {
				return reply.code(401).send({ error: "Sign in to continue." });
			}

			// Stage 2: the verified-only gate. Unverified sessions are confined
			// to the verification endpoints (and session/logout) until they hold
			// the mode-required verified_at stamp.
			if (
				isApiRoute &&
				routeConfig.public !== true &&
				routeConfig.verifyExempt !== true &&
				request.principal &&
				config.TWODB_REQUIRE_VERIFIED
			) {
				const user = await identityDb(fastify)
					.selectFrom("users")
					.select(["email_verified_at", "phone_verified_at"])
					.where("id", "=", request.principal.userId)
					.executeTakeFirst();
				if (!user || !userVerified(user, config.TWODB_IDENTIFIER)) {
					return reply.code(403).send({ error: "verify_required" });
				}
			}
		});
	},
	{ name: "twodb-identity-auth" },
);
