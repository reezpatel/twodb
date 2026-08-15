import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from "fastify";
import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Claim } from "@twodb/contracts";
import type { IdentityDB } from "@twodb/plugin-identity/schema";

export type WithWorkspaceSource =
	| { entity: "workspaces"; idParam: string }
	| { entity: "notes"; idParam: string }
	| { entity: string; idParam: string; workspaceField: string }
	| { workspaceIdBody: string };

export type WithWorkspaceOpts = WithWorkspaceSource;

const KNOWN_WORKSPACE_FIELD: Record<string, string> = {
	notes: "workspace_id",
	workspaces: "id",
};

export function makeWithWorkspace(fastify: FastifyInstance) {
	const db = (fastify as unknown as { db: Kysely<unknown> }).db;
	return function withWorkspace(opts: WithWorkspaceOpts): preHandlerHookHandler {
		return async (request: FastifyRequest, _reply) => {
			const principal = request.principal;
			if (!principal) {
				request.workspaceContext = null;
				request.claims = new Set();
				return;
			}

			const workspaceId = await resolveWorkspaceId(
				db as Kysely<IdentityDB>,
				request,
				opts,
			);
			if (!workspaceId) {
				request.workspaceContext = {
					workspaceId: "",
					roleClaims: new Set(),
					isMember: false,
				};
				request.claims = new Set();
				return;
			}

			const roleClaims = await loadRoleClaims(
				db as Kysely<IdentityDB>,
				workspaceId,
				principal.userId,
			);
			const isMember = await isWorkspaceMember(
				db as Kysely<IdentityDB>,
				workspaceId,
				principal.userId,
			);

			request.workspaceContext = {
				workspaceId,
				roleClaims,
				isMember,
			};
			request.claims = new Set(roleClaims);
		};
	};
}

async function resolveWorkspaceId(
	db: Kysely<IdentityDB>,
	request: FastifyRequest,
	opts: WithWorkspaceOpts,
): Promise<string | null> {
	if ("workspaceIdBody" in opts) {
		const body = request.body as Record<string, unknown> | undefined;
		const candidate = body?.[opts.workspaceIdBody];
		return typeof candidate === "string" ? candidate : null;
	}
	const idParam = (request.params as Record<string, unknown>)[opts.idParam];
	if (typeof idParam !== "string") return null;
	if (opts.entity === "workspaces") return idParam;

	const workspaceField =
		"workspaceField" in opts
			? opts.workspaceField
			: (KNOWN_WORKSPACE_FIELD[opts.entity] ?? "workspace_id");
	const row = await db
		.selectFrom(opts.entity as keyof IdentityDB & string)
		.select(workspaceField as never)
		.where("id", "=", idParam)
		.executeTakeFirst();
	if (!row) return null;
	const value = (row as Record<string, unknown>)[workspaceField];
	return typeof value === "string" ? value : null;
}

async function loadRoleClaims(
	db: Kysely<IdentityDB>,
	workspaceId: string,
	userId: string,
): Promise<Set<Claim>> {
	const rows = await sql<{ claim: string }>`
		SELECT rc.claim::text AS claim
		FROM workspace_role_assignments ra
		JOIN role_claims rc ON rc.role_id = ra.role_id
		WHERE ra.workspace_id = ${workspaceId}
		  AND ra.user_id = ${userId}
	`.execute(db as unknown as Kysely<{ claim: string }>);
	return new Set(rows.rows.map((r) => r.claim as Claim));
}

async function isWorkspaceMember(
	db: Kysely<IdentityDB>,
	workspaceId: string,
	userId: string,
): Promise<boolean> {
	const row = await db
		.selectFrom("workspace_members")
		.select("user_id")
		.where("workspace_id", "=", workspaceId)
		.where("user_id", "=", userId)
		.executeTakeFirst();
	return row !== undefined;
}
