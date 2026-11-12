import { sql, type Kysely } from "@twodb/core-data/db";
import { ulid } from "ulid";
import type { TwoThingDb } from "../db/schema.js";
import { randomCode } from "./codes.js";
import { HttpError } from "../gateway-context.js";

/** A code generated within this window can't be generated again. */
export const REISSUE_WINDOW_DAYS = 7;
export const MAX_BATCH = 1000;

/**
 * Bulk-allocates `count` fresh random codes for a workspace. A candidate is
 * rejected when it
 *   1. was generated (in any batch) within the last REISSUE_WINDOW_DAYS, or
 *   2. is currently on any item or location (used — forever off-limits).
 * Codes generated longer ago that were never used may be re-issued; the pool
 * row is then re-stamped to the new batch.
 *
 * Runs in one transaction under a per-workspace advisory lock, so two
 * concurrent print runs can never hand out the same code.
 */
export async function generateCodes(
  db: Kysely<TwoThingDb>,
  workspaceId: string,
  count: number,
  opts: { note?: string; batch?: boolean; /** test hook: deterministic candidate source */ random?: () => string } = {},
): Promise<{ batchId: string | null; codes: string[] }> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) throw new HttpError(400, "invalid_count", { max: MAX_BATCH });
  return db.transaction().execute(async (trx) => {
    await sql`select pg_advisory_xact_lock(hashtext(${"twothing:codes:" + workspaceId}))`.execute(trx);

    const batchId = opts.batch === false ? null : ulid();
    if (batchId) {
      await trx.insertInto("tt_code_batch").values({ id: batchId, workspace_id: workspaceId, count, note: opts.note ?? "", created_at: new Date() }).execute();
    }

    const accepted = new Set<string>();
    for (let round = 0; accepted.size < count; round++) {
      if (round > 20) throw new HttpError(503, "code_space_exhausted");
      const want = count - accepted.size;
      const candidates = new Set<string>();
      const next = opts.random ?? randomCode;
      for (let tries = 0; candidates.size < Math.ceil(want * 1.25) + 2 && tries < want * 50 + 100; tries++) {
        const c = next();
        if (!accepted.has(c)) candidates.add(c);
      }
      const list = [...candidates];
      if (!list.length) continue;

      const [recent, items, locations] = await Promise.all([
        trx
          .selectFrom("tt_code")
          .select("code")
          .where("workspace_id", "=", workspaceId)
          .where("code", "in", list)
          .where("generated_at", ">", sql<Date>`now() - make_interval(days => ${REISSUE_WINDOW_DAYS})`)
          .execute(),
        trx.selectFrom("tt_item").select("code").where("workspace_id", "=", workspaceId).where("code", "in", list).execute(),
        trx.selectFrom("tt_location").select("code").where("workspace_id", "=", workspaceId).where("code", "in", list).execute(),
      ]);
      const blocked = new Set([...recent, ...items, ...locations].map((r) => r.code));
      for (const c of list) {
        if (accepted.size >= count) break;
        if (!blocked.has(c)) accepted.add(c);
      }
    }

    const codes = [...accepted];
    const now = new Date();
    await trx
      .insertInto("tt_code")
      .values(codes.map((code) => ({ workspace_id: workspaceId, code, batch_id: batchId, generated_at: now })))
      .onConflict((oc) => oc.columns(["workspace_id", "code"]).doUpdateSet({ batch_id: batchId, generated_at: now }))
      .execute();
    return { batchId, codes };
  });
}

/** Is `code` free to be put on a new item/location? (in pool or brand-new, not used). */
export async function assertCodeFree(db: Kysely<TwoThingDb>, workspaceId: string, code: string, self?: { kind: "item" | "location"; id: string }) {
  const [item, loc] = await Promise.all([
    db.selectFrom("tt_item").select(["id", "name"]).where("workspace_id", "=", workspaceId).where("code", "=", code).executeTakeFirst(),
    db.selectFrom("tt_location").select(["id", "name"]).where("workspace_id", "=", workspaceId).where("code", "=", code).executeTakeFirst(),
  ]);
  if (item && !(self?.kind === "item" && self.id === item.id)) throw new HttpError(409, "code_in_use", { kind: "item", id: item.id, name: item.name });
  if (loc && !(self?.kind === "location" && self.id === loc.id)) throw new HttpError(409, "code_in_use", { kind: "location", id: loc.id, name: loc.name });
}

/** Make sure a code used on a row is tracked in the pool (typed/legacy codes). */
export async function trackCode(db: Kysely<TwoThingDb>, workspaceId: string, code: string) {
  await db
    .insertInto("tt_code")
    .values({ workspace_id: workspaceId, code, batch_id: null, generated_at: new Date() })
    .onConflict((oc) => oc.columns(["workspace_id", "code"]).doNothing())
    .execute();
}
