import { sql, type Kysely } from "@twodb/core-data/db";

// ---------------------------------------------------------------------------
// Garden schema (Postgres schema `garden`, provisioned by TwoDB).
//
//  database_record — ONE polymorphic node table:
//    kind = 'database' : a database. Its rows' property values live in the
//                        dynamic table db_<uuid> (see domain/dynamic-table.ts)
//    kind = 'field'    : a field (column) of a database. parent_id = database.
//                        The physical column in db_<uuid> is named by the
//                        field's uuid.
//    kind = 'page'     : a note. content = raw TipTap JSON. database_id = the
//                        database holding its properties (the space's default
//                        "Notes" database unless its parent is a database).
//  database_view   — saved views of a database (table/kanban/list/…)
//  record_link     — page → page mentions (backlinks), rebuilt on save
//  asset           — uploaded images / covers
// ---------------------------------------------------------------------------

export interface DatabaseRecordRow {
  id: string;
  workspace_id: string;
  space_id: string;
  kind: "database" | "field" | "page";
  parent_id: string | null;
  database_id: string | null;
  title: string;
  icon: string | null;
  cover: string | null;
  content: Record<string, unknown> | null;
  config: Record<string, unknown>;
  text_content: string;
  position: number;
  is_favorite: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  /** Root of the soft-deleted batch this record went to trash with. */
  trash_root_id: string | null;
}

export interface DatabaseViewRow {
  id: string;
  workspace_id: string;
  database_id: string;
  name: string;
  type: string;
  position: number;
  config: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface RecordLinkRow {
  source_id: string;
  target_id: string;
}

export interface AssetRow {
  id: string;
  workspace_id: string;
  record_id: string | null;
  name: string;
  content_type: string;
  size: number;
  data: Buffer;
  created_by: string | null;
  created_at: Date;
}

export interface GardenDb {
  database_record: DatabaseRecordRow;
  database_view: DatabaseViewRow;
  record_link: RecordLinkRow;
  asset: AssetRow;
}

/** Idempotent bootstrap (schema + role are provisioned by TwoDB). */
export async function applySchema(db: Kysely<GardenDb>): Promise<void> {
  await sql`
    create table if not exists database_record (
      id uuid primary key,
      workspace_id text not null,
      space_id text not null,
      kind text not null check (kind in ('database','field','page')),
      parent_id uuid references database_record(id) on delete cascade,
      database_id uuid references database_record(id) on delete cascade,
      title text not null default '',
      icon text,
      cover text,
      content jsonb,
      config jsonb not null default '{}'::jsonb,
      text_content text not null default '',
      search tsvector generated always as (
        setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('simple', left(coalesce(text_content, ''), 100000)), 'B')
      ) stored,
      position double precision not null default 0,
      is_favorite boolean not null default false,
      created_by text,
      updated_by text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz,
      trash_root_id uuid
    )`.execute(db);
  await sql`create index if not exists database_record_scope_kind_idx on database_record (workspace_id, space_id, kind) where deleted_at is null`.execute(db);
  await sql`create index if not exists database_record_parent_idx on database_record (parent_id)`.execute(db);
  await sql`create index if not exists database_record_database_idx on database_record (database_id, kind)`.execute(db);
  await sql`create index if not exists database_record_search_idx on database_record using gin (search)`.execute(db);
  await sql`create index if not exists database_record_trash_idx on database_record (trash_root_id) where trash_root_id is not null`.execute(db);
  // One default "Notes" database per space.
  await sql`create unique index if not exists database_record_default_db_uq on database_record (workspace_id, space_id)
    where kind = 'database' and (config->>'isDefault') = 'true'`.execute(db);

  await sql`
    create table if not exists database_view (
      id uuid primary key,
      workspace_id text not null,
      database_id uuid not null references database_record(id) on delete cascade,
      name text not null,
      type text not null check (type in ('table','kanban','list','gallery','calendar')),
      position double precision not null default 0,
      config jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`.execute(db);
  await sql`create index if not exists database_view_db_idx on database_view (database_id)`.execute(db);

  await sql`
    create table if not exists record_link (
      source_id uuid not null references database_record(id) on delete cascade,
      target_id uuid not null references database_record(id) on delete cascade,
      primary key (source_id, target_id)
    )`.execute(db);
  await sql`create index if not exists record_link_target_idx on record_link (target_id)`.execute(db);

  await sql`
    create table if not exists asset (
      id uuid primary key,
      workspace_id text not null,
      record_id uuid references database_record(id) on delete set null,
      name text not null default '',
      content_type text not null,
      size integer not null,
      data bytea not null,
      created_by text,
      created_at timestamptz not null default now()
    )`.execute(db);
}
