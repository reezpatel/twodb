import { sql, type Kysely } from "@twodb/core-data/db";

// ---------------------------------------------------------------------------
// TwoThing schema — one Postgres schema ("twothing") per AGENTS.md. Every row
// is scoped by workspace_id (forwarded by the Gateway).
//
//   tt_location   nested places: room › shelf › drawer › box (self-referencing)
//   tt_item       the things; `code` = our printed label, `barcodes` = the
//                 manufacturer's EAN/UPC/QR payloads found on the product
//   tt_code       pool of every label code ever generated (for the
//                 "not generated in the last 7 days + never used" rule)
//   tt_code_batch one row per bulk print run
//   tt_image      small re-encoded photos (client downsizes before upload)
//   tt_activity   append-only audit trail
// ---------------------------------------------------------------------------

export interface LocationRow {
  id: string;
  workspace_id: string;
  code: string | null;
  name: string;
  kind: string;
  parent_id: string | null;
  description: string;
  color: string | null;
  image_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ItemRow {
  id: string;
  workspace_id: string;
  code: string | null;
  name: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  min_quantity: number | null;
  location_id: string | null;
  tags: string[];
  barcodes: string[];
  specs: Record<string, string>;
  image_ids: string[];
  mpn: string;
  manufacturer: string;
  supplier: string;
  unit_cost: number | null;
  purchase_url: string;
  datasheet_url: string;
  notes: string;
  favorite: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CodeRow {
  workspace_id: string;
  code: string;
  batch_id: string | null;
  generated_at: Date;
}

export interface CodeBatchRow {
  id: string;
  workspace_id: string;
  count: number;
  note: string;
  created_at: Date;
}

export interface ImageRow {
  id: string;
  workspace_id: string;
  mime: string;
  data: Buffer;
  created_at: Date;
}

export interface ActivityRow {
  id: string;
  workspace_id: string;
  target_kind: string;
  target_id: string;
  target_name: string;
  action: string;
  detail: Record<string, unknown>;
  user_id: string | null;
  at: Date;
}

export interface TwoThingDb {
  tt_location: LocationRow;
  tt_item: ItemRow;
  tt_code: CodeRow;
  tt_code_batch: CodeBatchRow;
  tt_image: ImageRow;
  tt_activity: ActivityRow;
}

export async function applySchema(db: Kysely<TwoThingDb>): Promise<void> {
  // TwoDB's provisioner normally creates the schema; self-heal for bare dev DBs.
  // (Checked first: the least-privilege app role may lack CREATE on the
  // database, and Postgres checks that before IF NOT EXISTS.)
  const exists = await sql<{ n: number }>`select count(*)::int as n from information_schema.schemata where schema_name = 'twothing'`.execute(db);
  if (!exists.rows[0]?.n) await sql`create schema twothing`.execute(db);
  const now = sql`now()`;

  await db.schema
    .createTable("tt_location")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("code", "text")
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("kind", "text", (c) => c.notNull().defaultTo("box"))
    .addColumn("parent_id", "text")
    .addColumn("description", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("color", "text")
    .addColumn("image_id", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await sql`create unique index if not exists tt_location_code_uq on tt_location (workspace_id, code) where code is not null`.execute(db);
  await sql`create index if not exists tt_location_parent_idx on tt_location (workspace_id, parent_id)`.execute(db);

  await db.schema
    .createTable("tt_item")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("code", "text")
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("category", "text", (c) => c.notNull().defaultTo("other"))
    .addColumn("quantity", "double precision", (c) => c.notNull().defaultTo(0))
    .addColumn("unit", "text", (c) => c.notNull().defaultTo("pcs"))
    .addColumn("min_quantity", "double precision")
    .addColumn("location_id", "text")
    .addColumn("tags", "jsonb", (c) => c.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("barcodes", "jsonb", (c) => c.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("specs", "jsonb", (c) => c.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn("image_ids", "jsonb", (c) => c.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("mpn", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("manufacturer", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("supplier", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("unit_cost", "double precision")
    .addColumn("purchase_url", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("datasheet_url", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("notes", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("favorite", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await sql`create unique index if not exists tt_item_code_uq on tt_item (workspace_id, code) where code is not null`.execute(db);
  await sql`create index if not exists tt_item_location_idx on tt_item (workspace_id, location_id)`.execute(db);
  await sql`create index if not exists tt_item_barcodes_idx on tt_item using gin (barcodes)`.execute(db);

  await db.schema
    .createTable("tt_code_batch")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("count", "integer", (c) => c.notNull())
    .addColumn("note", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();

  await db.schema
    .createTable("tt_code")
    .ifNotExists()
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("code", "text", (c) => c.notNull())
    .addColumn("batch_id", "text")
    .addColumn("generated_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .addPrimaryKeyConstraint("tt_code_pk", ["workspace_id", "code"])
    .execute();
  await sql`create index if not exists tt_code_batch_idx on tt_code (workspace_id, batch_id)`.execute(db);

  await db.schema
    .createTable("tt_image")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("mime", "text", (c) => c.notNull())
    .addColumn("data", "bytea", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();

  await db.schema
    .createTable("tt_activity")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("target_kind", "text", (c) => c.notNull())
    .addColumn("target_id", "text", (c) => c.notNull())
    .addColumn("target_name", "text", (c) => c.notNull())
    .addColumn("action", "text", (c) => c.notNull())
    .addColumn("detail", "jsonb", (c) => c.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn("user_id", "text")
    .addColumn("at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await sql`create index if not exists tt_activity_ws_at_idx on tt_activity (workspace_id, at desc)`.execute(db);
  await sql`create index if not exists tt_activity_target_idx on tt_activity (workspace_id, target_id, at desc)`.execute(db);
}
