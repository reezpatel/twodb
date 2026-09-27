import type { Kysely } from "kysely";
import type { Database } from "../plugins/db";

export function findCodeDirectory(db: Kysely<Database>, organizationId: string, id: string) {
  return db.selectFrom("code_directory").select("id").where("id", "=", id).where("organizationId", "=", organizationId).executeTakeFirst();
}

/** Resolves an optional scope: absent/null -> org-level (null), string -> validated directory id. */
export async function resolveScope(
  db: Kysely<Database>,
  organizationId: string,
  value: unknown,
): Promise<{ ok: true; codeDirectoryId: string | null } | { ok: false; error: string }> {
  if (value === undefined || value === null) return { ok: true, codeDirectoryId: null };
  if (typeof value !== "string") return { ok: false, error: "invalid_directory" };
  const directory = await findCodeDirectory(db, organizationId, value);
  if (!directory) return { ok: false, error: "directory_not_found" };
  return { ok: true, codeDirectoryId: directory.id };
}
