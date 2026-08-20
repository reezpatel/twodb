import type { Principal } from "@twodb/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Every content route runs inside a workspace. The identity session hook has
 * already authenticated the request; this gate additionally requires the
 * `x-workspace-id` header to resolve to a workspace the user belongs to.
 * Returns null (after replying 403) or the workspace id.
 */
export function requireWorkspace(
	request: FastifyRequest,
	reply: FastifyReply,
): string | null {
	const principal = request.principal as Principal | null | undefined;
	if (!principal?.userId) {
		void reply.code(401).send({ error: "Not authenticated." });
		return null;
	}
	if (!principal.workspaceId || !principal.isWorkspaceMember) {
		void reply
			.code(403)
			.send({ error: "Select a workspace you belong to first." });
		return null;
	}
	return principal.workspaceId;
}
