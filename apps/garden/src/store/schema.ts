import { sql } from "@twodb/core-data/db";
import type { Scope } from "../gateway-context.js";
import type { Field, FieldConfig, FieldType, View, ViewConfig, ViewType } from "../shared/model.js";
import { PHYSICAL_FIELD_TYPES } from "../shared/model.js";
import { HttpError, notFound } from "../http.js";
import { addColumn, dropColumn, readColumn, replaceColumn } from "../domain/dynamic-table.js";
import { rootCtx, safeFieldExpr } from "../domain/field-expr.js";
import { toFieldDto, type FieldCatalog, type FieldDef } from "../domain/field-def.js";
import { renameProp } from "../domain/formula.js";
import { convertValues, defaultStatusOptions } from "../domain/values.js";
import type { DatabaseViewRow } from "../db/schema.js";
import { insertField, insertView, loadCatalog, loadFields, now, requireRecord, rowToField, type Db } from "./base.js";

export function fieldDtos(catalog: FieldCatalog, databaseId: string): Field[] {
  const ctx = rootCtx(catalog);
  return (catalog.get(databaseId) ?? []).map((f) => {
    if (f.type !== "formula" && f.type !== "rollup") return toFieldDto(f);
    const e = safeFieldExpr(f, ctx);
    return toFieldDto(f, e.type, e.error);
  });
}

export const toView = (v: DatabaseViewRow): View => ({
  id: v.id,
  databaseId: v.database_id,
  name: v.name,
  type: v.type as ViewType,
  position: v.position,
  config: (v.config ?? {}) as ViewConfig,
});

export async function listViews(db: Db, databaseId: string): Promise<View[]> {
  const rows = await db.selectFrom("database_view").selectAll().where("database_id", "=", databaseId).orderBy("position").orderBy("created_at").execute();
  return rows.map(toView);
}

async function requireField(db: Db, scope: Scope, fieldId: string): Promise<FieldDef> {
  const r = await requireRecord(db, scope, fieldId, { kind: "field" });
  return rowToField(r);
}

function normalizeConfig(type: FieldType, config: FieldConfig | undefined): FieldConfig {
  const c: FieldConfig = { ...(config ?? {}) };
  if ((type === "select" || type === "multi_select") && !c.options) c.options = [];
  if (type === "status" && !c.options?.length) c.options = defaultStatusOptions();
  if (type === "number" && !c.number) c.number = { format: "number" };
  if (type === "formula" && !c.formula) c.formula = { expression: "" };
  return c;
}

async function assertDatabase(db: Db, scope: Scope, databaseId: string) {
  return requireRecord(db, scope, databaseId, { kind: "database" });
}

export async function createField(
  db: Db,
  scope: Scope,
  databaseId: string,
  spec: { name: string; type: FieldType; config?: FieldConfig; position?: number; twoWay?: boolean; reverseName?: string },
): Promise<Field> {
  await assertDatabase(db, scope, databaseId);
  if (spec.type === "title" || spec.type === "created_time" || spec.type === "updated_time" || spec.type === "created_by")
    throw new HttpError(400, "system_field_type");
  const config = normalizeConfig(spec.type, spec.config);

  const id = await db.transaction().execute(async (trx) => {
    if (spec.type === "relation") {
      const target = config.relation?.databaseId;
      if (!target) throw new HttpError(400, "relation_target_required");
      const targetDb = await assertDatabase(trx, scope, target);
      const fieldId = crypto.randomUUID();
      let reverseFieldId: string | null = null;
      if (spec.twoWay) {
        reverseFieldId = crypto.randomUUID();
        const source = await assertDatabase(trx, scope, databaseId);
        await insertField(trx, scope, targetDb.id, {
          id: reverseFieldId,
          name: spec.reverseName?.trim() || `Related ${source.title || "Untitled"}`,
          type: "relation",
          config: { relation: { databaseId, reverseFieldId: fieldId } },
        });
      }
      config.relation = { ...config.relation!, databaseId: target, reverseFieldId };
      await insertField(trx, scope, databaseId, { id: fieldId, name: spec.name, type: spec.type, config, position: spec.position });
      return fieldId;
    }
    const f = await insertField(trx, scope, databaseId, { name: spec.name, type: spec.type, config, position: spec.position });
    return f.id;
  });
  const catalog = await loadCatalog(db, databaseId);
  return fieldDtos(catalog, databaseId).find((f) => f.id === id)!;
}

export async function updateField(
  db: Db,
  scope: Scope,
  fieldId: string,
  patch: { name?: string; type?: FieldType; config?: FieldConfig; position?: number },
): Promise<Field> {
  const field = await requireField(db, scope, fieldId);
  const databaseId = field.databaseId;

  await db.transaction().execute(async (trx) => {
    let type = field.type;
    let config: FieldConfig = patch.config ? { ...field.config, ...patch.config } : field.config;

    if (patch.type && patch.type !== field.type) {
      if (["title", "created_time", "updated_time", "created_by"].includes(patch.type)) throw new HttpError(400, "system_field_type");
      type = patch.type;
      const target = normalizeConfig(type, patch.config ?? (type === "relation" ? field.config : {}));
      if (type === "relation" && !target.relation?.databaseId) throw new HttpError(400, "relation_target_required");
      if (field.type === "relation" && field.config.relation?.reverseFieldId) await deleteReverse(trx, scope, field);

      const fromPhysical = PHYSICAL_FIELD_TYPES.has(field.type);
      const toPhysical = PHYSICAL_FIELD_TYPES.has(type);
      if (fromPhysical && toPhysical) {
        const rows = await readColumn(trx, databaseId, fieldId);
        const converted = convertValues(field, type, target, rows);
        config = converted.config;
        await replaceColumn(trx, databaseId, fieldId, type, converted.rows);
      } else if (fromPhysical) {
        config = target;
        await dropColumn(trx, databaseId, fieldId);
      } else {
        config = target;
        if (toPhysical) await addColumn(trx, databaseId, fieldId, type);
      }
      if (type === "relation") config.relation = { ...config.relation!, reverseFieldId: null };
    }

    // Removing select options clears them from stored values.
    if (patch.config?.options && (type === "select" || type === "status" || type === "multi_select") && type === field.type) {
      const keep = patch.config.options.map((o) => o.id);
      const col = sql.raw(`"${fieldId}"`);
      const table = sql.raw(`"db_${databaseId.replace(/-/g, "")}"`);
      if (type === "multi_select") {
        await sql`update ${table} set ${col} = nullif(array(select e from unnest(${col}) e where e = any(${keep}::text[])), '{}') where ${col} is not null`.execute(trx);
      } else {
        await sql`update ${table} set ${col} = null where ${col} is not null and not (${col} = any(${keep}::text[]))`.execute(trx);
      }
    }

    const name = patch.name?.trim() ? patch.name.trim().slice(0, 200) : field.name;
    await trx
      .updateTable("database_record")
      .set({
        title: name,
        config: { ...config, type } as Record<string, unknown>,
        ...(patch.position !== undefined ? { position: patch.position } : {}),
        updated_at: now(),
        updated_by: scope.actor,
      })
      .where("id", "=", fieldId)
      .execute();

    if (name !== field.name) await rewriteFormulas(trx, databaseId, field.name, name);
  });

  const catalog = await loadCatalog(db, databaseId);
  return fieldDtos(catalog, databaseId).find((f) => f.id === fieldId)!;
}

/** Keeps prop("Old name") references working after a rename. */
async function rewriteFormulas(db: Db, databaseId: string, oldName: string, newName: string) {
  for (const f of await loadFields(db, databaseId)) {
    const expr = f.config.formula?.expression;
    if (f.type !== "formula" || !expr) continue;
    const next = renameProp(expr, oldName, newName);
    if (next === expr) continue;
    await db
      .updateTable("database_record")
      .set({ config: { ...f.config, formula: { expression: next }, type: "formula" } as Record<string, unknown> })
      .where("id", "=", f.id)
      .execute();
  }
}

async function deleteReverse(db: Db, scope: Scope, field: FieldDef) {
  const reverseId = field.config.relation?.reverseFieldId;
  const target = field.config.relation?.databaseId;
  if (!reverseId || !target) return;
  await db.deleteFrom("database_record").where("id", "=", reverseId).where("kind", "=", "field").where("workspace_id", "=", scope.workspaceId).execute();
  await dropColumn(db, target, reverseId);
}

export async function deleteField(db: Db, scope: Scope, fieldId: string) {
  const field = await requireField(db, scope, fieldId);
  await db.transaction().execute(async (trx) => {
    if (field.type === "relation") {
      // Detach the partner instead of deleting it: it becomes a one-way relation.
      const reverseId = field.config.relation?.reverseFieldId;
      if (reverseId) {
        const partner = await trx.selectFrom("database_record").selectAll().where("id", "=", reverseId).executeTakeFirst();
        if (partner) {
          const pf = rowToField(partner);
          await trx
            .updateTable("database_record")
            .set({ config: { ...pf.config, relation: { ...pf.config.relation!, reverseFieldId: null }, type: "relation" } as Record<string, unknown> })
            .where("id", "=", reverseId)
            .execute();
        }
      }
    }
    await trx.deleteFrom("database_record").where("id", "=", fieldId).execute();
    await dropColumn(trx, field.databaseId, fieldId);
  });
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export async function createView(db: Db, scope: Scope, databaseId: string, spec: { name: string; type: ViewType; config?: ViewConfig }): Promise<View> {
  await assertDatabase(db, scope, databaseId);
  const config: ViewConfig = { ...(spec.config ?? {}) };
  if (spec.type === "kanban" && !config.groupBy) {
    const fields = await loadFields(db, databaseId);
    const g = fields.find((f) => f.type === "status") ?? fields.find((f) => f.type === "select") ?? fields.find((f) => f.type === "multi_select");
    if (g) config.groupBy = { fieldId: g.id };
  }
  if (spec.type === "calendar" && !config.calendar?.dateFieldId) {
    const fields = await loadFields(db, databaseId);
    const d = fields.find((f) => f.type === "date");
    config.calendar = { dateFieldId: d?.id ?? null };
  }
  const id = await insertView(db, scope, databaseId, { name: spec.name, type: spec.type, config });
  return toView((await db.selectFrom("database_view").selectAll().where("id", "=", id).executeTakeFirstOrThrow()) as DatabaseViewRow);
}

async function requireView(db: Db, scope: Scope, viewId: string) {
  const v = await db.selectFrom("database_view").selectAll().where("id", "=", viewId).where("workspace_id", "=", scope.workspaceId).executeTakeFirst();
  if (!v) throw notFound("view");
  await assertDatabase(db, scope, v.database_id);
  return v as DatabaseViewRow;
}

export async function getView(db: Db, scope: Scope, viewId: string) {
  return toView(await requireView(db, scope, viewId));
}

export async function updateView(db: Db, scope: Scope, viewId: string, patch: { name?: string; type?: ViewType; config?: ViewConfig; position?: number }) {
  await requireView(db, scope, viewId);
  const row = await db
    .updateTable("database_view")
    .set({
      ...(patch.name?.trim() ? { name: patch.name.trim().slice(0, 100) } : {}),
      ...(patch.type ? { type: patch.type } : {}),
      ...(patch.config ? { config: patch.config as Record<string, unknown> } : {}),
      ...(patch.position !== undefined ? { position: patch.position } : {}),
      updated_at: now(),
    })
    .where("id", "=", viewId)
    .returningAll()
    .executeTakeFirstOrThrow();
  return toView(row as DatabaseViewRow);
}

export async function deleteView(db: Db, scope: Scope, viewId: string) {
  const v = await requireView(db, scope, viewId);
  const count = await db.selectFrom("database_view").select(sql<number>`count(*)`.as("n")).where("database_id", "=", v.database_id).executeTakeFirst();
  if (Number(count?.n ?? 0) <= 1) throw new HttpError(409, "last_view", "A database needs at least one view");
  await db.deleteFrom("database_view").where("id", "=", viewId).execute();
}

export async function duplicateView(db: Db, scope: Scope, viewId: string) {
  const v = await requireView(db, scope, viewId);
  return createView(db, scope, v.database_id, { name: `${v.name} copy`, type: v.type as ViewType, config: v.config as ViewConfig });
}
