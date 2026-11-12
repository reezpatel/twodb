import { sql, type Kysely } from "@twodb/core-data/db";
import type { GardenDb, DatabaseRecordRow } from "../db/schema.js";
import type { Scope } from "../gateway-context.js";
import type { FieldConfig, FieldType, RecordRef, ViewConfig, ViewType } from "../shared/model.js";
import { notFound } from "../http.js";
import { addColumn, createDynamicTable, isUuid } from "../domain/dynamic-table.js";
import { systemFields, type FieldCatalog, type FieldDef } from "../domain/field-def.js";
import { newOption } from "../domain/values.js";

export type Db = Kysely<GardenDb>;

export const now = () => new Date();

export function inScope<QB extends { where: (...a: any[]) => QB }>(qb: QB, scope: Scope, alias = ""): QB {
  const p = alias ? `${alias}.` : "";
  return qb.where(`${p}workspace_id` as any, "=", scope.workspaceId).where(`${p}space_id` as any, "=", scope.spaceId);
}

export async function getRecord(db: Db, scope: Scope, id: string, opts: { includeDeleted?: boolean; kind?: DatabaseRecordRow["kind"] } = {}) {
  if (!isUuid(id)) return null;
  let q = db
    .selectFrom("database_record")
    .selectAll()
    .where("id", "=", id)
    .where("workspace_id", "=", scope.workspaceId)
    .where("space_id", "=", scope.spaceId);
  if (!opts.includeDeleted) q = q.where("deleted_at", "is", null);
  if (opts.kind) q = q.where("kind", "=", opts.kind);
  return (await q.executeTakeFirst()) ?? null;
}

export async function requireRecord(db: Db, scope: Scope, id: string, opts: { includeDeleted?: boolean; kind?: DatabaseRecordRow["kind"] } = {}) {
  const r = await getRecord(db, scope, id, opts);
  if (!r) throw notFound(opts.kind ?? "record");
  return r;
}

export const toRef = (r: Pick<DatabaseRecordRow, "id" | "kind" | "title" | "icon">): RecordRef => ({
  id: r.id,
  kind: r.kind === "database" ? "database" : "page",
  title: r.title,
  icon: r.icon,
});

export async function nextPosition(db: Db, scope: Scope, parentId: string | null, kind: DatabaseRecordRow["kind"] = "page") {
  let q = db
    .selectFrom("database_record")
    .select(sql<number>`coalesce(max(position), 0) + 1`.as("p"))
    .where("workspace_id", "=", scope.workspaceId)
    .where("space_id", "=", scope.spaceId)
    .where("deleted_at", "is", null);
  q = kind === "field" ? q.where("kind", "=", "field") : q.where("kind", "in", ["page", "database"]);
  q = parentId ? q.where("parent_id", "=", parentId) : q.where("parent_id", "is", null);
  const r = await q.executeTakeFirst();
  return Number(r?.p ?? 1);
}

// ---------------------------------------------------------------------------
// Databases + fields
// ---------------------------------------------------------------------------

export function rowToField(r: DatabaseRecordRow): FieldDef {
  const cfg = (r.config ?? {}) as FieldConfig & { type?: FieldType };
  const { type, ...config } = cfg;
  return { id: r.id, databaseId: r.database_id!, name: r.title, type: (type ?? "text") as FieldType, config, position: r.position, system: false };
}

export async function loadFields(db: Db, databaseId: string): Promise<FieldDef[]> {
  const rows = await db
    .selectFrom("database_record")
    .selectAll()
    .where("kind", "=", "field")
    .where("database_id", "=", databaseId)
    .where("deleted_at", "is", null)
    .orderBy("position")
    .orderBy("created_at")
    .execute();
  return [...systemFields(databaseId), ...rows.map(rowToField)].sort((a, b) => a.position - b.position);
}

/** Loads fields of a database and every database reachable through relations (rollups need them). */
export async function loadCatalog(db: Db, databaseId: string, depth = 3): Promise<FieldCatalog> {
  const catalog: FieldCatalog = new Map();
  let frontier = [databaseId];
  for (let d = 0; d <= depth && frontier.length; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      if (catalog.has(id)) continue;
      const fields = await loadFields(db, id);
      catalog.set(id, fields);
      for (const f of fields) {
        const target = f.config.relation?.databaseId;
        if (f.type === "relation" && target && !catalog.has(target)) next.push(target);
      }
    }
    frontier = next;
  }
  return catalog;
}

export async function insertField(
  db: Db,
  scope: Scope,
  databaseId: string,
  spec: { id?: string; name: string; type: FieldType; config?: FieldConfig; position?: number },
): Promise<FieldDef> {
  const id = spec.id ?? crypto.randomUUID();
  const position = spec.position ?? (await nextPosition(db, scope, databaseId, "field"));
  const t = now();
  await db
    .insertInto("database_record")
    .values({
      id,
      workspace_id: scope.workspaceId,
      space_id: scope.spaceId,
      kind: "field",
      parent_id: databaseId,
      database_id: databaseId,
      title: spec.name,
      config: { ...(spec.config ?? {}), type: spec.type } as Record<string, unknown>,
      position,
      created_by: scope.actor,
      updated_by: scope.actor,
      created_at: t,
      updated_at: t,
    } as never)
    .execute();
  await addColumn(db, databaseId, id, spec.type);
  return { id, databaseId, name: spec.name, type: spec.type, config: spec.config ?? {}, position, system: false };
}

export async function insertView(db: Db, scope: Scope, databaseId: string, spec: { name: string; type: ViewType; config?: ViewConfig; position?: number }) {
  const id = crypto.randomUUID();
  const t = now();
  let position = spec.position;
  if (position === undefined) {
    const r = await db.selectFrom("database_view").select(sql<number>`coalesce(max(position), 0) + 1`.as("p")).where("database_id", "=", databaseId).executeTakeFirst();
    position = Number(r?.p ?? 1);
  }
  await db
    .insertInto("database_view")
    .values({ id, workspace_id: scope.workspaceId, database_id: databaseId, name: spec.name, type: spec.type, position, config: (spec.config ?? {}) as Record<string, unknown>, created_at: t, updated_at: t })
    .execute();
  return id;
}

/** Creates a database record + its dynamic table + starter field/view. */
export async function createDatabaseRecord(
  db: Db,
  scope: Scope,
  spec: { parentId: string | null; title: string; inline?: boolean; isDefault?: boolean; icon?: string | null },
) {
  const id = crypto.randomUUID();
  const t = now();
  await db
    .insertInto("database_record")
    .values({
      id,
      workspace_id: scope.workspaceId,
      space_id: scope.spaceId,
      kind: "database",
      parent_id: spec.parentId,
      database_id: null,
      title: spec.title,
      icon: spec.icon ?? null,
      config: { ...(spec.inline ? { inline: true } : {}), ...(spec.isDefault ? { isDefault: true } : {}) },
      position: await nextPosition(db, scope, spec.parentId),
      created_by: scope.actor,
      updated_by: scope.actor,
      created_at: t,
      updated_at: t,
    } as never)
    .execute();
  await createDynamicTable(db, id);
  const tags = await insertField(db, scope, id, { name: "Tags", type: "multi_select", config: { options: [] }, position: 1 });
  if (spec.isDefault) {
    await insertView(db, scope, id, { name: "All docs", type: "list", position: 1, config: { sorts: [{ fieldId: "updated_time", direction: "desc" }], fields: [{ fieldId: tags.id }, { fieldId: "updated_time" }] } });
    await insertView(db, scope, id, { name: "Table", type: "table", position: 2 });
  } else {
    await insertView(db, scope, id, { name: "Table", type: "table", position: 1 });
  }
  return id;
}

/** The space's default "Notes" database (every page's home), created lazily. */
export async function defaultDatabaseId(db: Db, scope: Scope): Promise<string> {
  const find = () =>
    db
      .selectFrom("database_record")
      .select("id")
      .where("workspace_id", "=", scope.workspaceId)
      .where("space_id", "=", scope.spaceId)
      .where("kind", "=", "database")
      .where(sql<boolean>`(config->>'isDefault') = 'true'`)
      .executeTakeFirst();
  const existing = await find();
  if (existing) return existing.id;
  try {
    return await db.transaction().execute((trx) => createDatabaseRecord(trx, scope, { parentId: null, title: "Notes", isDefault: true }));
  } catch (err) {
    // Lost a creation race to a concurrent request — the unique index guarantees one.
    const again = await find();
    if (again) return again.id;
    throw err;
  }
}

export { newOption };
