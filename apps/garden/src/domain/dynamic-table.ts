import { sql, type Kysely } from "@twodb/core-data/db";
import type { RawBuilder } from "kysely";
import type { FieldType } from "../shared/model.js";

// ---------------------------------------------------------------------------
// Each database owns a real Postgres table `db_<uuid without dashes>` whose
// columns are named by field uuid. Identifiers are only ever built from
// validated uuids, so raw interpolation is safe.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(id: string): string {
  if (!UUID_RE.test(id)) throw new Error(`invalid uuid: ${id}`);
  return id.toLowerCase();
}

export const isUuid = (id: unknown): id is string => typeof id === "string" && UUID_RE.test(id);

export const tableName = (databaseId: string) => `db_${assertUuid(databaseId).replace(/-/g, "")}`;

/** Quoted identifier for a database's dynamic table. */
export const tableRef = (databaseId: string) => sql.raw(`"${tableName(databaseId)}"`);

/** Quoted column reference for a field, optionally qualified by a table alias. */
export const columnRef = (fieldId: string, alias?: string) =>
  sql.raw(`${alias ? `${alias}.` : ""}"${assertUuid(fieldId)}"`);

export const SQL_TYPES: Partial<Record<FieldType, string>> = {
  text: "text",
  url: "text",
  email: "text",
  phone: "text",
  select: "text",
  status: "text",
  number: "double precision",
  checkbox: "boolean",
  date: "timestamptz",
  multi_select: "text[]",
  person: "text[]",
  relation: "uuid[]",
};

export const sqlTypeOf = (type: FieldType): string | null => SQL_TYPES[type] ?? null;

export async function createDynamicTable(db: Kysely<any>, databaseId: string) {
  await sql`
    create table if not exists ${tableRef(databaseId)} (
      record_id uuid primary key references database_record(id) on delete cascade
    )`.execute(db);
}

export async function dropDynamicTable(db: Kysely<any>, databaseId: string) {
  await sql`drop table if exists ${tableRef(databaseId)}`.execute(db);
}

export async function addColumn(db: Kysely<any>, databaseId: string, fieldId: string, type: FieldType) {
  const t = sqlTypeOf(type);
  if (!t) return;
  await sql`alter table ${tableRef(databaseId)} add column if not exists ${columnRef(fieldId)} ${sql.raw(t)}`.execute(db);
}

export async function dropColumn(db: Kysely<any>, databaseId: string, fieldId: string) {
  await sql`alter table ${tableRef(databaseId)} drop column if exists ${columnRef(fieldId)}`.execute(db);
}

export async function ensureRow(db: Kysely<any>, databaseId: string, recordId: string) {
  await sql`insert into ${tableRef(databaseId)} (record_id) values (${recordId}::uuid) on conflict do nothing`.execute(db);
}

export async function deleteRow(db: Kysely<any>, databaseId: string, recordId: string) {
  await sql`delete from ${tableRef(databaseId)} where record_id = ${recordId}::uuid`.execute(db);
}

/** Typed SQL parameter for a value of the given field type (null-safe). */
export function typedParam(type: FieldType, value: unknown): RawBuilder<unknown> {
  const t = sqlTypeOf(type);
  if (!t) throw new Error(`field type ${type} has no column`);
  return sql`${value === undefined ? null : value}::${sql.raw(t)}`;
}

/** Upserts a set of column values for one record. */
export async function writeValues(
  db: Kysely<any>,
  databaseId: string,
  recordId: string,
  values: { fieldId: string; type: FieldType; value: unknown }[],
) {
  if (values.length === 0) return ensureRow(db, databaseId, recordId);
  const cols = sql.join(values.map((v) => columnRef(v.fieldId)));
  const params = sql.join(values.map((v) => typedParam(v.type, v.value)));
  const sets = sql.join(values.map((v) => sql`${columnRef(v.fieldId)} = excluded.${columnRef(v.fieldId)}`));
  await sql`
    insert into ${tableRef(databaseId)} (record_id, ${cols}) values (${recordId}::uuid, ${params})
    on conflict (record_id) do update set ${sets}`.execute(db);
}

/** Reads a single column for every row (used for type conversion). */
export async function readColumn(db: Kysely<any>, databaseId: string, fieldId: string): Promise<{ record_id: string; value: unknown }[]> {
  const r = await sql<{ record_id: string; value: unknown }>`
    select record_id, ${columnRef(fieldId)} as value from ${tableRef(databaseId)}
    where ${columnRef(fieldId)} is not null`.execute(db);
  return r.rows;
}

/**
 * Replaces a column with a new type, filling it with already-converted values.
 * Done as add-temp → bulk fill from jsonb → drop old → rename, so every type
 * combination goes through the same (JS-side) conversion path.
 */
export async function replaceColumn(
  db: Kysely<any>,
  databaseId: string,
  fieldId: string,
  newType: FieldType,
  rows: { record_id: string; value: unknown }[],
) {
  const t = sqlTypeOf(newType);
  await dropColumnTemp(db, databaseId, fieldId);
  if (!t) {
    await dropColumn(db, databaseId, fieldId);
    return;
  }
  const tmp = sql.raw(`"tmp_${assertUuid(fieldId).replace(/-/g, "")}"`);
  await sql`alter table ${tableRef(databaseId)} add column ${tmp} ${sql.raw(t)}`.execute(db);
  const filled = rows.filter((r) => r.value !== null && r.value !== undefined);
  for (let i = 0; i < filled.length; i += 500) {
    const chunk = filled.slice(i, i + 500).map((r) => ({ id: r.record_id, val: r.value }));
    await sql`
      update ${tableRef(databaseId)} t set ${tmp} = ${fromJsonb(newType, sql`v.val`)}
      from jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) as v(id uuid, val jsonb)
      where t.record_id = v.id`.execute(db);
  }
  await dropColumn(db, databaseId, fieldId);
  await sql`alter table ${tableRef(databaseId)} rename column ${tmp} to ${columnRef(fieldId)}`.execute(db);
}

async function dropColumnTemp(db: Kysely<any>, databaseId: string, fieldId: string) {
  const tmp = sql.raw(`"tmp_${assertUuid(fieldId).replace(/-/g, "")}"`);
  await sql`alter table ${tableRef(databaseId)} drop column if exists ${tmp}`.execute(db);
}

function fromJsonb(type: FieldType, v: RawBuilder<unknown>): RawBuilder<unknown> {
  switch (sqlTypeOf(type)) {
    case "text":
      return sql`(${v} #>> '{}')`;
    case "double precision":
      return sql`(${v} #>> '{}')::double precision`;
    case "boolean":
      return sql`(${v} #>> '{}')::boolean`;
    case "timestamptz":
      return sql`(${v} #>> '{}')::timestamptz`;
    case "text[]":
      return sql`array(select jsonb_array_elements_text(${v}))`;
    case "uuid[]":
      return sql`array(select jsonb_array_elements_text(${v}))::uuid[]`;
    default:
      return sql`null`;
  }
}

/** Array-append/remove helpers for two-way relation sync. */
export async function relationAdd(db: Kysely<any>, databaseId: string, fieldId: string, recordIds: string[], targetId: string) {
  if (!recordIds.length) return;
  for (const id of recordIds) await ensureRow(db, databaseId, id);
  await sql`
    update ${tableRef(databaseId)} set ${columnRef(fieldId)} = array_append(coalesce(${columnRef(fieldId)}, '{}'::uuid[]), ${targetId}::uuid)
    where record_id = any(${recordIds}::uuid[]) and not (${targetId}::uuid = any(coalesce(${columnRef(fieldId)}, '{}'::uuid[])))`.execute(db);
}

export async function relationRemove(db: Kysely<any>, databaseId: string, fieldId: string, recordIds: string[], targetId: string) {
  if (!recordIds.length) return;
  await sql`
    update ${tableRef(databaseId)} set ${columnRef(fieldId)} = array_remove(${columnRef(fieldId)}, ${targetId}::uuid)
    where record_id = any(${recordIds}::uuid[])`.execute(db);
}
