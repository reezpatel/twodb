import { createHash, randomBytes } from "node:crypto";
import { db } from "../auth";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const bytes = randomBytes(40);
  let body = "";
  for (let i = 0; i < 40; i++) body += ALPHABET[bytes[i] % ALPHABET.length];
  const key = `twodb_${body}`;
  return { key, prefix: key.slice(0, 12), hash: hashKey(key) };
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Resolves a plaintext key to its org, if valid and not revoked. */
export async function resolveApiKey(key: string): Promise<{ organizationId: string; keyId: string } | null> {
  const row = await db
    .selectFrom("api_key")
    .select(["id", "organizationId"])
    .where("hash", "=", hashKey(key))
    .where("revokedAt", "is", null)
    .executeTakeFirst();
  if (!row) return null;
  void db
    .updateTable("api_key")
    .set({ lastUsedAt: new Date() })
    .where("id", "=", row.id)
    .execute()
    .catch(() => undefined);
  return { organizationId: row.organizationId, keyId: row.id };
}
