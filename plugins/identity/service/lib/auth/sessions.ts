import { createHash, randomBytes } from "node:crypto";
import type { Kysely } from "kysely";
import type { Principal } from "../types";
import { newId } from "@twodb/shared-backend";
import type { IdentityDB } from "../../db/schema";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
	db: Kysely<IdentityDB>,
	userId: string,
	authMethod: string,
): Promise<{ token: string; expiresAt: Date }> {
	const token = randomBytes(32).toString("base64url");
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
	await db
		.insertInto("sessions")
		.values({
			id: newId("ses"),
			user_id: userId,
			token_hash: hashToken(token),
			auth_method: authMethod,
			expires_at: expiresAt,
		})
		.execute();
	return { token, expiresAt };
}

export async function resolveSession(
	db: Kysely<IdentityDB>,
	token: string,
): Promise<Principal | null> {
	const session = await db
		.selectFrom("sessions")
		.select(["id", "user_id", "expires_at"])
		.where("token_hash", "=", hashToken(token))
		.executeTakeFirst();
	if (!session) return null;
	if (session.expires_at < new Date()) {
		await db.deleteFrom("sessions").where("id", "=", session.id).execute();
		return null;
	}
	const admin = await db
		.selectFrom("platform_admins")
		.select("user_id")
		.where("user_id", "=", session.user_id)
		.executeTakeFirst();
	return {
		userId: session.user_id,
		isSuperadmin: admin !== undefined,
		workspaceId: null,
		claims: [],
		isWorkspaceMember: false,
	};
}

export async function destroySession(
	db: Kysely<IdentityDB>,
	token: string,
): Promise<void> {
	await db
		.deleteFrom("sessions")
		.where("token_hash", "=", hashToken(token))
		.execute();
}
