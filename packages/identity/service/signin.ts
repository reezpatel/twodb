import type { FastifyInstance, FastifyReply } from "fastify";
import type { Kysely } from "kysely";
import { SESSION_COOKIE, type Principal } from "@twodb/contracts";
import type { IdentityDB } from "./schema";
import { createSession } from "./sessions";

/** Issue the session cookie + bus fact, identically across every method. */
export async function startSession(
	fastify: FastifyInstance,
	reply: FastifyReply,
	db: Kysely<IdentityDB>,
	userId: string,
	authMethod: string,
): Promise<void> {
	const { token, expiresAt } = await createSession(db, userId, authMethod);
	fastify.bus.emit("twodb.identity.session.started", {
		userId,
		authMethod,
	});
	reply.setCookie(SESSION_COOKIE, token, {
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		expires: expiresAt,
	});
}

export async function principalFor(
	db: Kysely<IdentityDB>,
	userId: string,
): Promise<Principal> {
	const admin = await db
		.selectFrom("platform_admins")
		.select("user_id")
		.where("user_id", "=", userId)
		.executeTakeFirst();
	return { userId, isSuperadmin: admin !== undefined };
}
