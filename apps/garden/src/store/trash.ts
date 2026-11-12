import { sql } from "@twodb/core-data/db";
import type { Scope } from "../gateway-context.js";
import type { RecordRef, SearchHit, TrashItem } from "../shared/model.js";
import type { DatabaseRecordRow } from "../db/schema.js";
import { HttpError } from "../http.js";
import { dropColumn, dropDynamicTable, ensureRow } from "../domain/dynamic-table.js";
import { defaultDatabaseId, getRecord, now, requireRecord, toRef, type Db } from "./base.js";

/** Live subtree (pages + databases, incl. database rows) rooted at `id`. */
async function subtree(db: Db, id: string, deleted: boolean) {
  const r = await sql<{ id: string; kind: string }>`
    with recursive t as (
      select id, kind from database_record where id = ${id}::uuid
      union all
      select c.id, c.kind from database_record c join t on c.parent_id = t.id
      where c.kind in ('page','database') and (c.deleted_at is ${sql.raw(deleted ? "not null" : "null")})
    ) select id, kind from t`.execute(db);
  return r.rows;
}

export async function trashRecord(db: Db, scope: Scope, id: string) {
  const rec = await requireRecord(db, scope, id);
  if (rec.kind === "field") throw new HttpError(400, "use_fields_api");
  if (rec.kind === "database" && (rec.config as { isDefault?: boolean }).isDefault) throw new HttpError(400, "default_database_fixed");
  const ids = (await subtree(db, id, false)).map((r) => r.id);
  await db
    .updateTable("database_record")
    .set({ deleted_at: now(), trash_root_id: id, updated_by: scope.actor })
    .where("id", "in", ids)
    .where("deleted_at", "is", null)
    .execute();
}

export async function restoreRecord(db: Db, scope: Scope, id: string) {
  const rec = await requireRecord(db, scope, id, { includeDeleted: true });
  if (!rec.deleted_at || rec.trash_root_id !== rec.id) throw new HttpError(400, "not_in_trash");
  await db.transaction().execute(async (trx) => {
    await trx.updateTable("database_record").set({ deleted_at: null, trash_root_id: null }).where("trash_root_id", "=", id).execute();
    // The parent may have been trashed/deleted meanwhile: fall back to the root.
    const parent = rec.parent_id ? await getRecord(trx, scope, rec.parent_id) : null;
    if (rec.parent_id && !parent) {
      const set: Record<string, unknown> = { parent_id: null };
      if (rec.kind === "page") {
        const home = await defaultDatabaseId(trx, scope);
        if (home !== rec.database_id) {
          set.database_id = home;
          await ensureRow(trx, home, rec.id);
        }
      }
      await trx.updateTable("database_record").set(set).where("id", "=", id).execute();
    }
  });
}

export async function deletePermanently(db: Db, scope: Scope, id: string) {
  const rec = await requireRecord(db, scope, id, { includeDeleted: true });
  if (!rec.deleted_at) throw new HttpError(400, "trash_first");
  const nodes = await subtree(db, id, true);
  const dbIds = nodes.filter((n) => n.kind === "database").map((n) => n.id);
  await db.transaction().execute(async (trx) => {
    // Relation fields elsewhere pointing at a vanishing database go too.
    if (dbIds.length) {
      const dangling = await trx
        .selectFrom("database_record")
        .select(["id", "database_id"])
        .where("kind", "=", "field")
        .where("workspace_id", "=", scope.workspaceId)
        .where(sql<boolean>`(config->'relation'->>'databaseId') = any(${dbIds}::text[])`)
        .where("database_id", "not in", dbIds)
        .execute();
      for (const f of dangling) {
        await trx.deleteFrom("database_record").where("id", "=", f.id).execute();
        await dropColumn(trx, f.database_id!, f.id);
      }
      for (const d of dbIds) await dropDynamicTable(trx, d);
    }
    await trx.deleteFrom("database_record").where("id", "=", id).execute();
  });
}

export async function listTrash(db: Db, scope: Scope): Promise<TrashItem[]> {
  const rows = await sql<DatabaseRecordRow & { parent_title: string | null }>`
    select r.*, p.title as parent_title from database_record r left join database_record p on p.id = r.parent_id
    where r.workspace_id = ${scope.workspaceId} and r.space_id = ${scope.spaceId} and r.deleted_at is not null and r.trash_root_id = r.id
    order by r.deleted_at desc limit 500`.execute(db);
  return rows.rows.map((r) => ({ ...toRef(r), deletedAt: new Date(r.deleted_at!).toISOString(), parentTitle: r.parent_title }));
}

export async function emptyTrash(db: Db, scope: Scope) {
  for (const t of await listTrash(db, scope)) await deletePermanently(db, scope, t.id);
}

export async function search(db: Db, scope: Scope, q: string, opts: { databaseId?: string; limit?: number; kind?: "page" | "database" }): Promise<SearchHit[]> {
  const term = q.trim();
  const limit = Math.min(opts.limit ?? 20, 100);
  const like = `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const rows = await sql<DatabaseRecordRow & { parent_title: string | null; rank: number }>`
    select r.id, r.kind, r.title, r.icon, r.database_id, r.text_content, p.title as parent_title,
      ${term ? sql`ts_rank(r.search, websearch_to_tsquery('simple', ${term})) + (case when r.title ilike ${like} then 1 else 0 end)` : sql`0`} as rank
    from database_record r left join database_record p on p.id = r.parent_id
    where r.workspace_id = ${scope.workspaceId} and r.space_id = ${scope.spaceId} and r.deleted_at is null
      and r.kind ${opts.kind ? sql`= ${opts.kind}` : sql`in ('page','database')`}
      and not (r.kind = 'database' and (r.config->>'isDefault') = 'true')
      ${opts.databaseId ? sql`and r.database_id = ${opts.databaseId}::uuid and r.kind = 'page'` : sql``}
      ${term ? sql`and (r.search @@ websearch_to_tsquery('simple', ${term}) or r.title ilike ${like} or r.text_content ilike ${like})` : sql``}
    order by rank desc, r.updated_at desc limit ${limit}`.execute(db);
  return rows.rows.map((r) => {
    const text = r.text_content ?? "";
    const at = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
    const snippet = at >= 0 ? text.slice(Math.max(0, at - 40), at + 120) : text.slice(0, 140);
    return { ...toRef(r), databaseId: r.database_id, parentTitle: r.parent_title, snippet: snippet.replace(/\s+/g, " ").trim() };
  });
}

export async function backlinks(db: Db, scope: Scope, id: string): Promise<(RecordRef & { snippet: string })[]> {
  await requireRecord(db, scope, id, { includeDeleted: true });
  const rows = await db
    .selectFrom("record_link as l")
    .innerJoin("database_record as r", "r.id", "l.source_id")
    .select(["r.id", "r.kind", "r.title", "r.icon", "r.text_content"])
    .where("l.target_id", "=", id)
    .where("r.deleted_at", "is", null)
    .where("r.workspace_id", "=", scope.workspaceId)
    .orderBy("r.updated_at", "desc")
    .execute();
  return rows.map((r) => ({ ...toRef(r as DatabaseRecordRow), snippet: (r.text_content ?? "").slice(0, 140) }));
}
