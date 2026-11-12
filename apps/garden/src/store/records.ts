import { sql } from "@twodb/core-data/db";
import type { Scope } from "../gateway-context.js";
import type { DatabaseDetail, RecordDetail, RecordRef, TreeNode } from "../shared/model.js";
import type { DatabaseRecordRow } from "../db/schema.js";
import { HttpError } from "../http.js";
import { deleteRow, ensureRow } from "../domain/dynamic-table.js";
import { emptyDoc, extractEmbeddedDatabases, extractMentions, extractText } from "../domain/content.js";
import { createDatabaseRecord, defaultDatabaseId, getRecord, nextPosition, now, requireRecord, toRef, type Db } from "./base.js";
import { fieldDtos, listViews } from "./schema.js";
import { recordValues, updateValues } from "./rows.js";

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

/** Ancestors from the root down to the direct parent. */
export async function ancestors(db: Db, scope: Scope, rec: DatabaseRecordRow): Promise<RecordRef[]> {
  if (!rec.parent_id) return [];
  const r = await sql<{ id: string; kind: string; title: string; icon: string | null; depth: number }>`
    with recursive up as (
      select id, parent_id, kind, title, icon, 1 as depth from database_record where id = ${rec.parent_id}::uuid and workspace_id = ${scope.workspaceId}
      union all
      select p.id, p.parent_id, p.kind, p.title, p.icon, up.depth + 1 from database_record p join up on p.id = up.parent_id where up.depth < 50
    ) select id, kind, title, icon, depth from up order by depth desc`.execute(db);
  return r.rows.map((x) => toRef(x as unknown as DatabaseRecordRow));
}

export async function tree(db: Db, scope: Scope): Promise<{ nodes: TreeNode[]; favorites: TreeNode[]; defaultDatabaseId: string }> {
  const defaultId = await defaultDatabaseId(db, scope);
  const rows = await sql<DatabaseRecordRow & { parent_kind: string | null; child_count: string }>`
    select n.id, n.kind, n.parent_id, n.database_id, n.title, n.icon, n.position, n.is_favorite, n.config, p.kind as parent_kind,
      (select count(*) from database_record c where c.parent_id = n.id and c.kind in ('page','database') and c.deleted_at is null) as child_count
    from database_record n left join database_record p on p.id = n.parent_id
    where n.workspace_id = ${scope.workspaceId} and n.space_id = ${scope.spaceId} and n.deleted_at is null
      and n.kind in ('page','database') and n.id <> ${defaultId}::uuid
      and (n.is_favorite or n.parent_id is null or p.kind = 'page')
    order by n.position asc, n.created_at asc`.execute(db);
  const toNode = (r: (typeof rows.rows)[number]): TreeNode => ({
    ...toRef(r),
    parentId: r.parent_id,
    databaseId: r.database_id,
    position: r.position,
    isFavorite: r.is_favorite,
    inline: Boolean((r.config as { inline?: boolean })?.inline),
    childCount: Number(r.child_count),
  });
  const nodes = rows.rows.filter((r) => r.parent_id === null || r.parent_kind === "page").map(toNode);
  const favorites = rows.rows.filter((r) => r.is_favorite).map(toNode);
  return { nodes, favorites, defaultDatabaseId: defaultId };
}

/** Rows of a database for the sidebar (titles only). */
export async function children(db: Db, scope: Scope, parentId: string, limit = 100): Promise<TreeNode[]> {
  const rows = await sql<DatabaseRecordRow & { child_count: string }>`
    select n.*, (select count(*) from database_record c where c.parent_id = n.id and c.kind in ('page','database') and c.deleted_at is null) as child_count
    from database_record n where n.parent_id = ${parentId}::uuid and n.workspace_id = ${scope.workspaceId} and n.space_id = ${scope.spaceId}
      and n.deleted_at is null and n.kind in ('page','database')
    order by n.position asc, n.created_at asc limit ${limit}`.execute(db);
  return rows.rows.map((r) => ({
    ...toRef(r),
    parentId: r.parent_id,
    databaseId: r.database_id,
    position: r.position,
    isFavorite: r.is_favorite,
    inline: Boolean((r.config as { inline?: boolean })?.inline),
    childCount: Number(r.child_count),
  }));
}

/** The database a page under `parent` must belong to (invariant: db rows are children of their db). */
async function homeDatabase(db: Db, scope: Scope, parent: DatabaseRecordRow | null) {
  return parent?.kind === "database" ? parent.id : defaultDatabaseId(db, scope);
}

export async function createPage(
  db: Db,
  scope: Scope,
  spec: { parentId?: string | null; title?: string; icon?: string | null; content?: Record<string, unknown>; values?: Record<string, unknown>; position?: number },
) {
  const parent = spec.parentId ? await requireRecord(db, scope, spec.parentId) : null;
  if (parent && parent.kind === "field") throw new HttpError(400, "invalid_parent");
  const databaseId = await homeDatabase(db, scope, parent);
  const parentId = parent && !(parent.kind === "database" && (parent.config as { isDefault?: boolean }).isDefault) ? parent.id : null;
  const id = crypto.randomUUID();
  const t = now();
  const content = spec.content ?? emptyDoc();
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("database_record")
      .values({
        id,
        workspace_id: scope.workspaceId,
        space_id: scope.spaceId,
        kind: "page",
        parent_id: parentId,
        database_id: databaseId,
        title: (spec.title ?? "").slice(0, 500),
        icon: spec.icon ?? null,
        content,
        text_content: extractText(content),
        config: {},
        position: spec.position ?? (await nextPosition(trx, scope, parentId)),
        created_by: scope.actor,
        updated_by: scope.actor,
        created_at: t,
        updated_at: t,
      } as never)
      .execute();
    await ensureRow(trx, databaseId, id);
  });
  if (spec.values && Object.keys(spec.values).length) await updateValues(db, scope, databaseId, id, spec.values);
  return id;
}

export async function createDatabase(db: Db, scope: Scope, spec: { parentId?: string | null; title?: string; inline?: boolean; icon?: string | null }) {
  const parent = spec.parentId ? await requireRecord(db, scope, spec.parentId) : null;
  if (parent && parent.kind !== "page") throw new HttpError(400, "databases_live_under_pages");
  return db.transaction().execute((trx) =>
    createDatabaseRecord(trx, scope, { parentId: parent?.id ?? null, title: spec.title ?? "", inline: spec.inline && !!parent, icon: spec.icon }),
  );
}

export async function recordDetail(db: Db, scope: Scope, id: string): Promise<RecordDetail> {
  const rec = await requireRecord(db, scope, id, { includeDeleted: true });
  if (rec.kind === "field") throw new HttpError(404, "record_not_found");
  const base: RecordDetail = {
    ...toRef(rec),
    parentId: rec.parent_id,
    databaseId: rec.database_id,
    cover: rec.cover,
    content: rec.kind === "page" ? rec.content : null,
    config: rec.config ?? {},
    isFavorite: rec.is_favorite,
    createdAt: iso(rec.created_at)!,
    updatedAt: iso(rec.updated_at)!,
    createdBy: rec.created_by,
    deletedAt: iso(rec.deleted_at),
    ancestors: await ancestors(db, scope, rec),
  };
  if (rec.kind === "database") return { ...base, isDefaultDatabase: Boolean((rec.config as { isDefault?: boolean }).isDefault) };
  const { catalog, row, relations } = await recordValues(db, scope, rec.database_id!, rec.id);
  return { ...base, fields: fieldDtos(catalog, rec.database_id!), values: row?.values ?? {}, relations };
}

export async function databaseDetail(db: Db, scope: Scope, id: string): Promise<DatabaseDetail> {
  const database = await recordDetail(db, scope, id);
  if (database.kind !== "database") throw new HttpError(404, "database_not_found");
  const { loadCatalog } = await import("./base.js");
  const catalog = await loadCatalog(db, id);
  return { database, fields: fieldDtos(catalog, id), views: await listViews(db, id) };
}

async function isDescendant(db: Db, ancestorId: string, nodeId: string): Promise<boolean> {
  const r = await sql<{ hit: boolean }>`
    with recursive up as (
      select id, parent_id, 0 as d from database_record where id = ${nodeId}::uuid
      union all select p.id, p.parent_id, up.d + 1 from database_record p join up on p.id = up.parent_id where up.d < 60
    ) select exists(select 1 from up where id = ${ancestorId}::uuid) as hit`.execute(db);
  return Boolean(r.rows[0]?.hit);
}

export interface RecordPatch {
  title?: string;
  icon?: string | null;
  cover?: string | null;
  content?: Record<string, unknown>;
  config?: Record<string, unknown>;
  isFavorite?: boolean;
  parentId?: string | null;
  position?: number;
}

export async function patchRecord(db: Db, scope: Scope, id: string, patch: RecordPatch) {
  const rec = await requireRecord(db, scope, id);
  if (rec.kind === "field") throw new HttpError(400, "use_fields_api");
  const isDefault = rec.kind === "database" && (rec.config as { isDefault?: boolean }).isDefault;
  const set: Record<string, unknown> = { updated_at: now(), updated_by: scope.actor };
  if (patch.title !== undefined) set.title = patch.title.slice(0, 500);
  if (patch.icon !== undefined) set.icon = patch.icon;
  if (patch.cover !== undefined) set.cover = patch.cover;
  if (patch.isFavorite !== undefined) set.is_favorite = patch.isFavorite;
  if (patch.position !== undefined) set.position = patch.position;
  if (patch.config !== undefined) {
    const { isDefault: _d, inline: _i, ...rest } = patch.config;
    set.config = { ...(rec.config ?? {}), ...rest };
  }

  await db.transaction().execute(async (trx) => {
    if (patch.parentId !== undefined && patch.parentId !== rec.parent_id) {
      if (isDefault) throw new HttpError(400, "default_database_fixed");
      const parent = patch.parentId ? await requireRecord(trx, scope, patch.parentId) : null;
      if (parent?.kind === "field") throw new HttpError(400, "invalid_parent");
      if (rec.kind === "database" && parent && parent.kind !== "page") throw new HttpError(400, "databases_live_under_pages");
      if (parent && (parent.id === rec.id || (await isDescendant(trx, rec.id, parent.id)))) throw new HttpError(400, "cannot_move_into_descendant");
      const parentIsDefault = parent?.kind === "database" && (parent.config as { isDefault?: boolean }).isDefault;
      set.parent_id = parentIsDefault ? null : (parent?.id ?? null);
      if (patch.position === undefined) set.position = await nextPosition(trx, scope, (set.parent_id as string | null) ?? null);
      if (rec.kind === "database") set.config = { ...((set.config as object) ?? rec.config), inline: false };
      if (rec.kind === "page") {
        const home = await homeDatabase(trx, scope, parent);
        if (home !== rec.database_id) {
          await deleteRow(trx, rec.database_id!, rec.id); // properties don't carry across databases
          await ensureRow(trx, home, rec.id);
          set.database_id = home;
        }
      }
    }

    if (patch.content !== undefined && rec.kind === "page") {
      set.content = patch.content;
      set.text_content = extractText(patch.content);
      await syncLinks(trx, scope, rec.id, extractMentions(patch.content));
      await syncInlineDatabases(trx, scope, rec.id, extractEmbeddedDatabases(patch.content));
    }
    await trx.updateTable("database_record").set(set).where("id", "=", id).execute();
  });
}

async function syncLinks(db: Db, scope: Scope, sourceId: string, targets: string[]) {
  await db.deleteFrom("record_link").where("source_id", "=", sourceId).execute();
  const valid = targets.filter((t) => /^[0-9a-f-]{36}$/i.test(t) && t !== sourceId);
  if (!valid.length) return;
  const live = await db.selectFrom("database_record").select("id").where("id", "in", valid).where("workspace_id", "=", scope.workspaceId).execute();
  if (live.length) await db.insertInto("record_link").values(live.map((l) => ({ source_id: sourceId, target_id: l.id }))).onConflict((oc) => oc.doNothing()).execute();
}

/** Child databases embedded in the page are "inline"; removing the block turns them into regular sub-databases (reversible). */
async function syncInlineDatabases(db: Db, scope: Scope, pageId: string, embedded: string[]) {
  const childDbs = await db
    .selectFrom("database_record")
    .select(["id", "config"])
    .where("parent_id", "=", pageId)
    .where("kind", "=", "database")
    .where("workspace_id", "=", scope.workspaceId)
    .execute();
  for (const c of childDbs) {
    const inline = embedded.includes(c.id);
    if (Boolean((c.config as { inline?: boolean }).inline) === inline) continue;
    await db.updateTable("database_record").set({ config: { ...c.config, inline } }).where("id", "=", c.id).execute();
  }
}

export { getRecord };
