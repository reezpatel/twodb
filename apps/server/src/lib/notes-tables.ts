import { sql, type Kysely } from "kysely";
import type { Database, NoteGroupMetadata, NotePropertyType } from "../plugins/db";

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

/** Physical table name for a note-group: notes_<groupId, dashes stripped>. */
export const notesTableName = (groupId: string) => `notes_${groupId.replace(/[^a-zA-Z0-9]/g, "")}`;

/** Leaf kinds — the node kinds that own a physical notes table. */
export const LEAF_KINDS = ["notes", "checklist", "table", "sheet", "canvas"] as const;

const ident = (name: string) => sql.raw(`"${name.replace(/"/g, "")}"`);

const table = (groupId: string) => ident(notesTableName(groupId));

export function defaultMetadata(): NoteGroupMetadata {
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

export async function ensureGroupTable(db: Kysely<Database>, groupId: string) {
  await sql`
    CREATE TABLE IF NOT EXISTS ${table(groupId)} (
      "noteId" text PRIMARY KEY REFERENCES note_item("id") ON DELETE CASCADE,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `.execute(db);
}

export async function dropGroupTable(db: Kysely<Database>, groupId: string) {
  await sql`DROP TABLE IF EXISTS ${table(groupId)}`.execute(db);
}

export async function addPropertyColumn(db: Kysely<Database>, groupId: string, propertyId: string, type: NotePropertyType) {
  await sql`ALTER TABLE ${table(groupId)} ADD COLUMN ${ident(propertyId)} ${sql.raw(PROPERTY_SQL[type])}`.execute(db);
}

export async function dropPropertyColumn(db: Kysely<Database>, groupId: string, propertyId: string) {
  await sql`ALTER TABLE ${table(groupId)} DROP COLUMN IF EXISTS ${ident(propertyId)}`.execute(db);
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

export async function changePropertyColumnType(db: Kysely<Database>, groupId: string, propertyId: string, from: NotePropertyType, to: NotePropertyType) {
  // Look up the actual SQL column type so the USING expression matches the
  // real source data. This handles legacy columns where multiselect was a plain
  // `text` column rather than `text[]` (no array_to_string is available).
  const infoRows = await sql<{ data_type: string }>`
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${notesTableName(groupId)}
      AND column_name = ${propertyId}
  `.execute(db);
  const actualFromSqlType = infoRows.rows[0]?.data_type ?? PROPERTY_SQL[from];
  const expr = castExpr(propertyId, from, to, actualFromSqlType);

  const sqlText = `ALTER TABLE ${table(groupId)} ALTER COLUMN ${ident(propertyId)} TYPE ${sql.raw(PROPERTY_SQL[to])} USING ${sql.raw(expr)}`;
  console.log("[changePropertyColumnType]", {
    groupId,
    propertyId,
    from,
    to,
    actualFromSqlType,
    propertySql: PROPERTY_SQL[to],
    expr,
    sqlText,
  });
  await sql`ALTER TABLE ${table(groupId)} ALTER COLUMN ${ident(propertyId)} TYPE ${sql.raw(PROPERTY_SQL[to])} USING ${sql.raw(expr)}`.execute(db);
}

export interface NoteRow {
  noteId: string;
  title: string;
  content: unknown;
  preview: string;
  createdAt: Date;
  updatedAt: Date;
  props: Record<string, unknown>;
}

export async function listNotes(db: Kysely<Database>, groupId: string): Promise<NoteRow[]> {
  const items = await db.selectFrom("note_item").selectAll().where("nodeId", "=", groupId).orderBy("createdAt", "desc").execute();
  const dyn = await sql`SELECT * FROM ${table(groupId)}`.execute(db);
  const propsById = new Map<string, Record<string, unknown>>();
  for (const raw of dyn.rows as Record<string, unknown>[]) {
    const { noteId, createdAt, updatedAt, ...props } = raw;
    void createdAt;
    void updatedAt;
    propsById.set(String(noteId), props);
  }
  return items.map((i) => ({
    noteId: i.id,
    title: i.title,
    content: i.content,
    preview: i.preview,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    props: propsById.get(i.id) ?? {},
  }));
}

export async function insertNote(
  db: Kysely<Database>,
  groupId: string,
  noteId: string,
  title: string,
  content: unknown,
  preview: string,
  props: Record<string, unknown>,
) {
  const now = new Date();
  await db
    .insertInto("note_item")
    .values({ id: noteId, nodeId: groupId, title, content: (content ?? {}) as Record<string, unknown>, preview, createdAt: now, updatedAt: now })
    .execute();
  const cols = [sql.raw('"noteId"'), ...Object.keys(props).map((k) => ident(k))];
  const values = [sql`${noteId}`, ...Object.values(props).map((v) => sql`${v}`)];
  await sql`INSERT INTO ${table(groupId)} (${sql.join(cols, sql.raw(", "))}) VALUES (${sql.join(values, sql.raw(", "))})`.execute(db);
}

export async function updateNote(
  db: Kysely<Database>,
  groupId: string,
  noteId: string,
  patch: { title?: string; content?: unknown; preview?: string; props?: Record<string, unknown> },
) {
  const itemPatch: { title?: string; content?: Record<string, unknown>; preview?: string; updatedAt: Date } = { updatedAt: new Date() };
  if (patch.title !== undefined) itemPatch.title = patch.title;
  if (patch.content !== undefined) itemPatch.content = patch.content as Record<string, unknown>;
  if (patch.preview !== undefined) itemPatch.preview = patch.preview;
  await db.updateTable("note_item").set(itemPatch).where("id", "=", noteId).execute();

  const sets = [sql.raw(`"updatedAt" = now()`)];
  for (const [key, value] of Object.entries(patch.props ?? {})) {
    sets.push(sql`${ident(key)} = ${value}`);
  }
  await sql`UPDATE ${table(groupId)} SET ${sql.join(sets, sql.raw(", "))} WHERE "noteId" = ${noteId}`.execute(db);
}

/** Deleting the inventory row cascades the dynamic row via FK. */
export async function deleteNote(db: Kysely<Database>, groupId: string, noteId: string) {
  await db.deleteFrom("note_item").where("id", "=", noteId).where("nodeId", "=", groupId).execute();
}
