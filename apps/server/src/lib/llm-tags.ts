import { db } from "../auth";

/** Validates a request-body tags field; undefined means "not provided". */
export function parseTags(value: unknown): string[] | "invalid" | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !v.trim())) return "invalid";
  return [...new Set(value.map((v) => v.trim()))];
}

/** Additively records tag names in the shared per-org suggestion list. */
export async function syncLlmTags(organizationId: string, tags: string[] | undefined): Promise<void> {
  const names = [...new Set((tags ?? []).map((t) => t.trim()).filter(Boolean))];
  if (names.length === 0) return;

  const now = new Date();
  await db
    .insertInto("llm_tag")
    .values(names.map((name) => ({ id: crypto.randomUUID(), organizationId, name, createdAt: now, updatedAt: now })))
    .onConflict((oc) => oc.doNothing())
    .execute();
}
