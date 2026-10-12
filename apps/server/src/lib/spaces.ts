import type { Context } from "hono";
import { db } from "../auth";

/**
 * Resolves the `x-space-ids` header into org-owned space ids. Empty header or
 * "all" means no filtering — the client sends no header when every space is
 * selected, so old clients and API keys stay unaffected.
 */
export async function resolveSpaceIds(c: Context, organizationId: string): Promise<string[] | null> {
  const raw = c.req.header("x-space-ids");
  if (!raw) return null;

  const requested = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (requested.length === 0) return null;

  const rows = await db
    .selectFrom("space")
    .select("id")
    .where("organizationId", "=", organizationId)
    .execute();
  const orgIds = new Set(rows.map((r) => r.id));
  const valid = requested.filter((id) => orgIds.has(id));
  return valid.length > 0 ? valid : null;
}

/**
 * Validates an incoming `spaceId` (POST/PATCH body): null/undefined passes
 * through, "" → null, any other string must belong to the org. Returns
 * { error } on a foreign id.
 */
export async function validateSpaceId(
  organizationId: string,
  spaceId: unknown,
): Promise<{ ok: true; spaceId: string | null } | { ok: false; error: "invalid_space" }> {
  if (spaceId === undefined || spaceId === null) return { ok: true, spaceId: null };
  if (typeof spaceId !== "string") return { ok: false, error: "invalid_space" };
  const trimmed = spaceId.trim();
  if (!trimmed) return { ok: true, spaceId: null };
  const row = await db
    .selectFrom("space")
    .select("id")
    .where("id", "=", trimmed)
    .where("organizationId", "=", organizationId)
    .executeTakeFirst();
  if (!row) return { ok: false, error: "invalid_space" };
  return { ok: true, spaceId: row.id };
}

/**
 * Resource-space matching. A null-space resource (spaceId = null) is visible
 * everywhere; a spaced resource only matches the exact space. A session in an
 * unspaced directory (sessionSpaceId = null) sees only null-space resources.
 */
export function spaceMatches(resourceSpaceId: string | null | undefined, sessionSpaceId: string | null): boolean {
  if (!resourceSpaceId) return true;
  return resourceSpaceId === sessionSpaceId;
}

/** The space of a code directory (null = base/no space). */
export async function getDirectorySpaceId(organizationId: string, codeDirectoryId: string | null): Promise<string | null> {
  if (!codeDirectoryId) return null;
  const row = await db
    .selectFrom("code_directory")
    .select("spaceId")
    .where("id", "=", codeDirectoryId)
    .where("organizationId", "=", organizationId)
    .executeTakeFirst();
  return row?.spaceId ?? null;
}