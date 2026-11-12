import { sql } from "@twodb/core-data/db";
import type { RawBuilder } from "kysely";
import type { Scope } from "../gateway-context.js";
import type { FilterGroup, QueryResult, RecordRef, Row, SortSpec } from "../shared/model.js";
import { PHYSICAL_FIELD_TYPES } from "../shared/model.js";
import { HttpError } from "../http.js";
import { ensureRow, relationAdd, relationRemove, tableRef, writeValues } from "../domain/dynamic-table.js";
import { rootCtx, safeFieldExpr } from "../domain/field-expr.js";
import { compileFilter, compileSorts } from "../domain/filters.js";
import type { FieldCatalog, FieldDef } from "../domain/field-def.js";
import { coerceValue } from "../domain/values.js";
import { loadCatalog, now, type Db } from "./base.js";

export interface RowQuery {
  filter?: FilterGroup | null;
  sorts?: SortSpec[];
  search?: string;
  limit?: number;
  offset?: number;
  recordIds?: string[];
}

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : (d as string | null));

function normalizeValue(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  return v;
}

/** Runs a view-style query over a database's rows (pages with database_id = db). */
export async function queryRows(db: Db, scope: Scope, databaseId: string, q: RowQuery, catalog?: FieldCatalog): Promise<QueryResult> {
  catalog ??= await loadCatalog(db, databaseId);
  const fields = catalog.get(databaseId) ?? [];
  const ctx = rootCtx(catalog);
  const valueFields = fields.filter((f) => !f.system);
  const compiled = valueFields.map((f) => ({ f, e: safeFieldExpr(f, ctx) }));

  const where: RawBuilder<unknown>[] = [
    sql`r.kind = 'page'`,
    sql`r.database_id = ${databaseId}::uuid`,
    sql`r.workspace_id = ${scope.workspaceId}`,
    sql`r.space_id = ${scope.spaceId}`,
    sql`r.deleted_at is null`,
  ];
  const f = compileFilter(q.filter ?? null, fields, ctx);
  if (f) where.push(f);
  if (q.search?.trim()) where.push(sql`(r.title ilike ${`%${q.search.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`})`);
  if (q.recordIds) where.push(sql`r.id = any(${q.recordIds}::uuid[])`);

  const order = [...compileSorts(q.sorts, fields, ctx), sql`r.position asc`, sql`r.created_at asc`];
  const selects = compiled.map(({ e }, i) => sql`${e.sql} as ${sql.raw(`"v${i}"`)}`);
  const limit = Math.min(Math.max(q.limit ?? 500, 1), 2000);

  const whereSql = sql.join(where, sql` and `);
  const from = sql`database_record r left join ${tableRef(databaseId)} s on s.record_id = r.id`;
  const [rowsRes, countRes] = await Promise.all([
    sql<Record<string, unknown>>`
      select r.id, r.title, r.icon, r.cover, left(r.text_content, 240) as preview, r.is_favorite, r.created_at, r.updated_at, r.created_by
      ${selects.length ? sql`, ${sql.join(selects)}` : sql``}
      from ${from} where ${whereSql}
      order by ${sql.join(order)}
      limit ${limit} offset ${Math.max(q.offset ?? 0, 0)}`.execute(db),
    sql<{ n: string }>`select count(*) as n from ${from} where ${whereSql}`.execute(db),
  ]);

  const rows: Row[] = rowsRes.rows.map((r) => {
    const values: Record<string, unknown> = {};
    compiled.forEach(({ f }, i) => (values[f.id] = normalizeValue(r[`v${i}`])));
    return {
      id: r.id as string,
      title: r.title as string,
      icon: r.icon as string | null,
      cover: r.cover as string | null,
      preview: (r.preview as string) ?? "",
      isFavorite: r.is_favorite as boolean,
      createdAt: iso(r.created_at)!,
      updatedAt: iso(r.updated_at)!,
      createdBy: r.created_by as string | null,
      values,
    };
  });

  return { rows, total: Number(countRes.rows[0]?.n ?? 0), relations: await relationRefs(db, scope, valueFields, rows) };
}

/** Titles/icons for every record referenced by relation values in `rows`. */
export async function relationRefs(db: Db, scope: Scope, fields: FieldDef[], rows: { values: Record<string, unknown> }[]): Promise<Record<string, RecordRef>> {
  const ids = new Set<string>();
  for (const f of fields) {
    if (f.type !== "relation") continue;
    for (const r of rows) for (const id of (r.values[f.id] as string[] | null) ?? []) ids.add(id);
  }
  if (!ids.size) return {};
  const refs = await db
    .selectFrom("database_record")
    .select(["id", "kind", "title", "icon"])
    .where("id", "in", [...ids])
    .where("workspace_id", "=", scope.workspaceId)
    .execute();
  return Object.fromEntries(refs.map((r) => [r.id, { id: r.id, kind: r.kind === "database" ? "database" : "page", title: r.title, icon: r.icon } as RecordRef]));
}

/** Property values of a single page (any page — every page lives in a database). */
export async function recordValues(db: Db, scope: Scope, databaseId: string, recordId: string) {
  const catalog = await loadCatalog(db, databaseId);
  const res = await queryRows(db, scope, databaseId, { recordIds: [recordId], limit: 1 }, catalog);
  return { catalog, row: res.rows[0] ?? null, relations: res.relations };
}

/**
 * Writes property values for one record. Validates each value against its
 * field, keeps two-way relations in sync and bumps updated_at.
 */
export async function updateValues(db: Db, scope: Scope, databaseId: string, recordId: string, input: Record<string, unknown>) {
  const catalog = await loadCatalog(db, databaseId, 1);
  const fields = catalog.get(databaseId) ?? [];
  const writes: { fieldId: string; type: FieldDef["type"]; value: unknown }[] = [];
  let title: string | undefined;

  for (const [fieldId, raw] of Object.entries(input)) {
    if (fieldId === "title") {
      title = typeof raw === "string" ? raw.slice(0, 500) : "";
      continue;
    }
    const field = fields.find((f) => f.id === fieldId);
    if (!field) throw new HttpError(400, "unknown_field", fieldId);
    if (!PHYSICAL_FIELD_TYPES.has(field.type)) throw new HttpError(400, "read_only_field", field.name);
    writes.push({ fieldId, type: field.type, value: coerceValue(field, raw) });
  }

  await db.transaction().execute(async (trx) => {
    // Two-way relation bookkeeping needs the old values.
    const twoWay = writes.filter((w) => {
      const f = fields.find((x) => x.id === w.fieldId)!;
      return f.type === "relation" && f.config.relation?.reverseFieldId;
    });
    let before: Record<string, string[] | null> = {};
    if (twoWay.length) {
      const cols = sql.join(twoWay.map((w) => sql`${sql.raw(`"${w.fieldId}"`)} as ${sql.raw(`"${w.fieldId}"`)}`));
      const r = await sql<Record<string, string[] | null>>`select ${cols} from ${tableRef(databaseId)} where record_id = ${recordId}::uuid`.execute(trx);
      before = r.rows[0] ?? {};
    }

    await writeValues(trx, databaseId, recordId, writes);

    for (const w of twoWay) {
      const f = fields.find((x) => x.id === w.fieldId)!;
      const rel = f.config.relation!;
      const oldIds = new Set(before[w.fieldId] ?? []);
      const newIds = new Set((w.value as string[] | null) ?? []);
      const added = [...newIds].filter((id) => !oldIds.has(id) && id !== recordId);
      const removed = [...oldIds].filter((id) => !newIds.has(id));
      // only sync rows that actually belong to the target database
      const valid = added.length
        ? (await trx.selectFrom("database_record").select("id").where("id", "in", added).where("database_id", "=", rel.databaseId).execute()).map((r) => r.id)
        : [];
      await relationAdd(trx, rel.databaseId, rel.reverseFieldId!, valid, recordId);
      await relationRemove(trx, rel.databaseId, rel.reverseFieldId!, removed, recordId);
    }

    await trx
      .updateTable("database_record")
      .set({ updated_at: now(), updated_by: scope.actor, ...(title !== undefined ? { title } : {}) })
      .where("id", "=", recordId)
      .execute();
  });
}

export { ensureRow };
