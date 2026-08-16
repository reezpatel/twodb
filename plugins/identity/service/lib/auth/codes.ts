import { createHash, randomBytes, randomInt } from "node:crypto";
import type { Kysely } from "kysely";
import { newId } from "@twodb/shared-backend";
import type { IdentityDB } from "../../db/schema";

/**
 * One outstanding code per (identifier, purpose): issuing a new one replaces
 * the old. Codes are stored hashed (sha256), single-use, TTL-bound, and die
 * after 5 wrong attempts.
 */
const MAX_ATTEMPTS = 5;

export type CodeKind = "otp" | "token";

export function hashCode(raw: string): string {
	return createHash("sha256").update(raw).digest("hex");
}

export async function issueCode(
	db: Kysely<IdentityDB>,
	identifier: string,
	purpose: string,
	kind: CodeKind,
	ttlMs: number,
): Promise<string> {
	const raw =
		kind === "otp"
			? randomInt(0, 1_000_000).toString().padStart(6, "0")
			: randomBytes(32).toString("base64url");
	await db
		.deleteFrom("verification_codes")
		.where("identifier", "=", identifier)
		.where("purpose", "=", purpose)
		.execute();
	await db
		.insertInto("verification_codes")
		.values({
			id: newId("vcd"),
			identifier,
			code_hash: hashCode(raw),
			purpose,
			expires_at: new Date(Date.now() + ttlMs),
		})
		.execute();
	return raw;
}

export async function consumeCode(
	db: Kysely<IdentityDB>,
	identifier: string,
	purpose: string,
	raw: string,
): Promise<boolean> {
	const row = await db
		.selectFrom("verification_codes")
		.select(["id", "code_hash", "attempts", "expires_at"])
		.where("identifier", "=", identifier)
		.where("purpose", "=", purpose)
		.executeTakeFirst();
	if (!row) return false;
	if (row.expires_at < new Date() || row.attempts >= MAX_ATTEMPTS) {
		await db
			.deleteFrom("verification_codes")
			.where("id", "=", row.id)
			.execute();
		return false;
	}
	if (row.code_hash !== hashCode(raw)) {
		const attempts = row.attempts + 1;
		if (attempts >= MAX_ATTEMPTS) {
			// 5th wrong guess kills the code — ask for a fresh one.
			await db
				.deleteFrom("verification_codes")
				.where("id", "=", row.id)
				.execute();
		} else {
			await db
				.updateTable("verification_codes")
				.set({ attempts })
				.where("id", "=", row.id)
				.execute();
		}
		return false;
	}
	// Single-use: success consumes the code.
	await db.deleteFrom("verification_codes").where("id", "=", row.id).execute();
	return true;
}

/**
 * Consume a high-entropy bearer token (magic links) without knowing its
 * identifier up front — the link carries only the token. Returns the
 * identifier the token was issued to, or null.
 */
export async function consumeToken(
	db: Kysely<IdentityDB>,
	purpose: string,
	raw: string,
): Promise<string | null> {
	const row = await db
		.selectFrom("verification_codes")
		.select(["id", "identifier", "expires_at"])
		.where("code_hash", "=", hashCode(raw))
		.where("purpose", "=", purpose)
		.executeTakeFirst();
	if (!row) return null;
	await db.deleteFrom("verification_codes").where("id", "=", row.id).execute();
	if (row.expires_at < new Date()) return null;
	return row.identifier;
}
