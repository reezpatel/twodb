import type { FastifyInstance } from "fastify";
import { sql } from "@twodb/core-data/db";
import { z } from "zod";
import { generateCodes, MAX_BATCH, REISSUE_WINDOW_DAYS } from "../lib/code-pool.js";
import { formatCode, normalizeCode } from "../lib/codes.js";
import { itemDto } from "../lib/items.js";
import { LocationTree } from "../lib/locations.js";
import { HttpError } from "../gateway-context.js";
import { authed, type Ctx } from "./context.js";

const generateBody = z.object({ count: z.number().int().min(1).max(MAX_BATCH), note: z.string().max(200).optional() });

export function registerCodeRoutes(app: FastifyInstance, { db }: Ctx) {
  app.post(
    "/codes/generate",
    authed(async ({ workspaceId: ws }, req, reply) => {
      const body = generateBody.parse(req.body);
      const { batchId, codes } = await generateCodes(db, ws, body.count, { note: body.note });
      return reply.code(201).send({ batchId, codes: codes.map((code) => ({ code, display: formatCode(code) })), reissueWindowDays: REISSUE_WINDOW_DAYS });
    }),
  );

  /** One fresh code, not attached to a batch (e.g. "auto-assign" in the add form preview). */
  app.post(
    "/codes/next",
    authed(async ({ workspaceId: ws }) => {
      const { codes } = await generateCodes(db, ws, 1, { batch: false });
      return { code: codes[0], display: formatCode(codes[0]) };
    }),
  );

  app.get(
    "/codes/batches",
    authed(async ({ workspaceId: ws }) => {
      const rows = await sql<{ id: string; count: number; note: string; created_at: Date; live: number; used: number }>`
        select b.id, b.count, b.note, b.created_at,
          (select count(*)::int from tt_code c where c.workspace_id = b.workspace_id and c.batch_id = b.id) as live,
          (select count(*)::int from tt_code c where c.workspace_id = b.workspace_id and c.batch_id = b.id and (
              exists (select 1 from tt_item i where i.workspace_id = c.workspace_id and i.code = c.code) or
              exists (select 1 from tt_location l where l.workspace_id = c.workspace_id and l.code = c.code))) as used
        from tt_code_batch b where b.workspace_id = ${ws}
        order by b.created_at desc limit 200`.execute(db);
      const pool = await sql<{ free: number; fresh: number }>`
        select
          count(*) filter (where not used)::int as free,
          count(*) filter (where not used and generated_at > now() - make_interval(days => ${REISSUE_WINDOW_DAYS}))::int as fresh
        from (
          select c.generated_at,
            exists (select 1 from tt_item i where i.workspace_id = c.workspace_id and i.code = c.code) or
            exists (select 1 from tt_location l where l.workspace_id = c.workspace_id and l.code = c.code) as used
          from tt_code c where c.workspace_id = ${ws}
        ) s`.execute(db);
      return {
        batches: rows.rows.map((r) => ({ id: r.id, count: r.count, note: r.note, createdAt: new Date(r.created_at).toISOString(), live: r.live, used: r.used })),
        pool: pool.rows[0] ?? { free: 0, fresh: 0 },
        reissueWindowDays: REISSUE_WINDOW_DAYS,
      };
    }),
  );

  app.get(
    "/codes/batches/:id",
    authed<{ id: string }>(async ({ workspaceId: ws }, req) => {
      const batch = await db.selectFrom("tt_code_batch").selectAll().where("workspace_id", "=", ws).where("id", "=", req.params.id).executeTakeFirst();
      if (!batch) throw new HttpError(404, "batch_not_found");
      const rows = await sql<{ code: string; item_id: string | null; item_name: string | null; loc_id: string | null; loc_name: string | null }>`
        select c.code, i.id as item_id, i.name as item_name, l.id as loc_id, l.name as loc_name
        from tt_code c
        left join tt_item i on i.workspace_id = c.workspace_id and i.code = c.code
        left join tt_location l on l.workspace_id = c.workspace_id and l.code = c.code
        where c.workspace_id = ${ws} and c.batch_id = ${batch.id}
        order by c.code`.execute(db);
      return {
        batch: { id: batch.id, count: batch.count, note: batch.note, createdAt: new Date(batch.created_at).toISOString() },
        codes: rows.rows.map((r) => ({
          code: r.code,
          display: formatCode(r.code),
          usedBy: r.item_id ? { kind: "item", id: r.item_id, name: r.item_name } : r.loc_id ? { kind: "location", id: r.loc_id, name: r.loc_name } : null,
        })),
      };
    }),
  );

  /**
   * What did I just scan? Our label → the item/place it's on (or "free label,
   * create something with it"); a manufacturer EAN/UPC/QR → items carrying it.
   */
  app.get(
    "/resolve",
    authed<Record<string, string>, { code?: string }>(async ({ workspaceId: ws }, req) => {
      const raw = (req.query.code ?? "").trim();
      if (!raw) throw new HttpError(400, "code_required");
      const code = normalizeCode(raw);
      const upper = raw.toUpperCase().slice(0, 64);
      const keys = [...new Set([code, upper].filter(Boolean) as string[])];
      const tree = await LocationTree.load(db, ws, true);

      const [items, locs, byBarcode, pooled] = await Promise.all([
        db.selectFrom("tt_item").selectAll().where("workspace_id", "=", ws).where("code", "in", keys).execute(),
        db.selectFrom("tt_location").selectAll().where("workspace_id", "=", ws).where("code", "in", keys).execute(),
        db
          .selectFrom("tt_item")
          .selectAll()
          .where("workspace_id", "=", ws)
          .where(sql<boolean>`barcodes @> ${JSON.stringify([raw])}::jsonb`)
          .limit(20)
          .execute(),
        code ? db.selectFrom("tt_code").selectAll().where("workspace_id", "=", ws).where("code", "=", code).executeTakeFirst() : undefined,
      ]);

      const seen = new Set<string>();
      const matches: unknown[] = [];
      for (const l of locs) matches.push({ type: "location", location: tree.toDto(l) });
      for (const i of [...items, ...byBarcode]) {
        if (seen.has(i.id)) continue;
        seen.add(i.id);
        matches.push({ type: "item", via: items.includes(i) ? "label" : "barcode", item: itemDto(i, tree) });
      }
      if (!matches.length && code) {
        matches.push({ type: "free_code", code, display: formatCode(code), inPool: !!pooled, generatedAt: pooled ? new Date(pooled.generated_at).toISOString() : null });
      }
      return { raw, code, matches };
    }),
  );
}
