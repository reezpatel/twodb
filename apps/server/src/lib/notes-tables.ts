import { sql, type Kysely } from "kysely";
import type { Database, NoteDatabaseSchema, NotePropertyType } from "../plugins/db";

const PROPERTY_SQL: Record<NotePropertyType, string> = {
  text: "text",
  number: "double precision",
  select: "text",
  multiselect: "text[]",
  status: "text",
  date: "timestamp",
  person: "text",
  "files & media": "text",
  checkbox: "boolean",
  url: "text",
  phone: "text",
  email: "text",
  id: "text",
  place: "text",
};

export const PROPERTY_TYPES = Object.keys(PROPERTY_SQL) as NotePropertyType[];

/** Physical property table for a database node: notes_<databaseId, dashes stripped>. */
export const notesTableName = (databaseId: string) => `notes_${databaseId.replace(/[^a-zA-Z0-9]/g, "")}`;

const ident = (name: string) => sql.raw(`"${name.replace(/"/g, "")}"`);

const table = (databaseId: string) => ident(notesTableName(databaseId));

export function defaultSchema(): NoteDatabaseSchema {
  return {
    columns: [],
    views: [
      { id: crypto.randomUUID(), name: "Table", type: "table" },
      { id: crypto.randomUUID(), name: "List", type: "list" },
      { id: crypto.randomUUID(), name: "Kanban", type: "kanban" },
    ],
  };
}

export function newPropertyId() {
  return `p_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export async function ensureDatabaseTable(db: Kysely<Database>, databaseId: string) {
  await sql`
    CREATE TABLE IF NOT EXISTS ${table(databaseId)} (
      "noteId" text PRIMARY KEY REFERENCES note_node("id") ON DELETE CASCADE,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `.execute(db);
}

export async function addPropertyColumn(db: Kysely<Database>, databaseId: string, propertyId: string, type: NotePropertyType) {
  await sql`ALTER TABLE ${table(databaseId)} ADD COLUMN ${ident(propertyId)} ${sql.raw(PROPERTY_SQL[type])}`.execute(db);
}

export async function dropPropertyColumn(db: Kysely<Database>, databaseId: string, propertyId: string) {
  await sql`ALTER TABLE ${table(databaseId)} DROP COLUMN IF EXISTS ${ident(propertyId)}`.execute(db);
}

const NUMBER_TEXT_RE = "^[+-]?[0-9]+(\\.[0-9]+)?([eE][+-]?[0-9]+)?$";

function castExpr(col: string, from: NotePropertyType, to: NotePropertyType, actualFromSqlType?: string): string {
  const c = `"${col}"`;
  if (from === to) return c;

  // Going FROM multiselect → single-value type. Branch on the actual source type
  // so we work for legacy columns where multiselect was a plain `text` (no
  // array_to_string) and for new columns where multiselect is `text[]`.
  if (from === "multiselect") {
    const isArray = actualFromSqlType === "text[]" || actualFromSqlType === "ARRAY" || actualFromSqlType?.startsWith("text[") === true;
    if (isArray) {
      if (to === "checkbox") return `(array_length(${c}) > 0)`;
      if (to === "number") return `NULLIF(array_to_string(${c}, ','), '')::double precision`;
      if (to === "date") return `NULLIF(array_to_string(${c}, ','), '')::timestamp`;
      return `NULLIF(array_to_string(${c}, ','), '')`;
    }
    // Legacy text column: identity cast.
    return `${c}::text`;
  }

  // Going TO multiselect (text[]) from a single-value type: wrap in a one-element array.
  if (to === "multiselect") {
    return `ARRAY[${c}::text]`;
  }

  switch (to) {
    case "text":
    case "url":
    case "select":
    case "status":
    case "person":
    case "files & media":
    case "phone":
    case "email":
    case "id":
    case "place":
      return `${c}::text`;
    case "number":
      if (from === "checkbox") return `(CASE WHEN ${c} THEN 1 WHEN NOT ${c} THEN 0 ELSE NULL END)`;
      if (from === "date") return `(EXTRACT(EPOCH FROM ${c}))::double precision`;
      return `(CASE WHEN ${c}::text ~ '${NUMBER_TEXT_RE}' THEN (${c}::text)::double precision ELSE NULL END)`;
    case "checkbox":
      if (from === "number") return `(CASE WHEN ${c} IS NULL THEN NULL WHEN ${c} <> 0 THEN true ELSE false END)`;
      if (from === "date") return `(${c} IS NOT NULL)`;
      return `(CASE WHEN lower(${c}::text) IN ('true','t','yes','y','1','on') THEN true WHEN lower(${c}::text) IN ('false','f','no','n','0','off','') THEN false ELSE NULL END)`;
    case "date":
      if (from === "number") return `(CASE WHEN ${c}::text ~ '${NUMBER_TEXT_RE}' THEN to_timestamp(${c}) ELSE NULL END)`;
      if (from === "checkbox") return `NULL`;
      return `(NULLIF(trim(${c}::text), ''))::timestamp`;
  }
}

export async function changePropertyColumnType(db: Kysely<Database>, databaseId: string, propertyId: string, from: NotePropertyType, to: NotePropertyType) {
  // Look up the actual SQL column type so the USING expression matches the
  // real source data. This handles legacy columns where multiselect was a plain
  // `text` column rather than `text[]` (no array_to_string is available).
  const infoRows = await sql<{ data_type: string }>`
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = ${notesTableName(databaseId)}
      AND column_name = ${propertyId}
  `.execute(db);
  const actualFromSqlType = infoRows.rows[0]?.data_type ?? PROPERTY_SQL[from];
  const expr = castExpr(propertyId, from, to, actualFromSqlType);

  await sql`ALTER TABLE ${table(databaseId)} ALTER COLUMN ${ident(propertyId)} TYPE ${sql.raw(PROPERTY_SQL[to])} USING ${sql.raw(expr)}`.execute(db);
}

export interface NoteRow {
  noteId: string;
  title: string;
  icon: string | null;
  cover: string | null;
  content: unknown;
  preview: string;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
  props: Record<string, unknown>;
}

/** Rows of a database = its live (non-deleted) child pages + their property
 *  values from the database's notes_<id> table. Oldest first (new rows append). */
export async function listNotes(db: Kysely<Database>, databaseId: string): Promise<NoteRow[]> {
  const pages = await db
    .selectFrom("note_node")
    .selectAll()
    .where("parentId", "=", databaseId)
    .where("kind", "=", "page")
    .where("deletedAt", "is", null)
    .orderBy("position", "asc")
    .orderBy("createdAt", "asc")
    .execute();
  const dyn = await sql`SELECT * FROM ${table(databaseId)}`.execute(db);
  const propsById = new Map<string, Record<string, unknown>>();
  for (const raw of dyn.rows as Record<string, unknown>[]) {
    const { noteId, createdAt, updatedAt, ...props } = raw;
    void createdAt;
    void updatedAt;
    propsById.set(String(noteId), props);
  }
  return pages.map((p) => ({
    noteId: p.id,
    title: p.title,
    icon: p.icon,
    cover: p.cover,
    content: p.content ?? {},
    preview: p.preview,
    isFavorite: p.isFavorite,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    props: propsById.get(p.id) ?? {},
  }));
}

/** Inserts the property row for an existing row page. */
export async function insertRowProps(db: Kysely<Database>, databaseId: string, noteId: string, props: Record<string, unknown>) {
  const cols = [sql.raw('"noteId"'), ...Object.keys(props).map((k) => ident(k))];
  const values = [sql`${noteId}`, ...Object.values(props).map((v) => sql`${v}`)];
  await sql`INSERT INTO ${table(databaseId)} (${sql.join(cols, sql.raw(", "))}) VALUES (${sql.join(values, sql.raw(", "))}) ON CONFLICT ("noteId") DO NOTHING`.execute(db);
}

export async function updateRowProps(db: Kysely<Database>, databaseId: string, noteId: string, props: Record<string, unknown>) {
  const sets = [sql.raw(`"updatedAt" = now()`)];
  for (const [key, value] of Object.entries(props)) sets.push(sql`${ident(key)} = ${value}`);
  await sql`UPDATE ${table(databaseId)} SET ${sql.join(sets, sql.raw(", "))} WHERE "noteId" = ${noteId}`.execute(db);
}
