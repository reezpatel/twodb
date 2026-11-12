import { sql, type Kysely } from "@twodb/core-data/db";

export interface BoardRow {
  id: string;
  workspace_id: string;
  space_id: string;
  kind: "diagram" | "doc";
  name: string;
  description: string;
  doc_markdown: string;
  doc_version: number;
  last_seq: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ItemRow {
  id: string;
  board_id: string;
  key: string | null;
  type: string;
  parent_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  locked: boolean;
  pinned: boolean;
  data: Record<string, unknown>;
  version: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BoardEventRow {
  seq: number;
  board_id: string;
  actor: string;
  origin: string | null;
  batch_id: string;
  label: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AssetRow {
  id: string;
  board_id: string;
  workspace_id: string;
  s3_key: string;
  content_type: string;
  size: number;
  name: string;
  created_by: string;
  created_at: string;
}

export interface PaintressDb {
  boards: BoardRow;
  items: ItemRow;
  board_events: BoardEventRow;
  assets: AssetRow;
}

/** Idempotent schema bootstrap (the schema + role are provisioned by TwoDB). */
export async function applySchema(db: Kysely<PaintressDb>): Promise<void> {
  await sql`
    create table if not exists boards (
      id text primary key,
      workspace_id text not null,
      space_id text not null,
      kind text not null check (kind in ('diagram','doc')),
      name text not null,
      description text not null default '',
      doc_markdown text not null default '',
      doc_version integer not null default 0,
      last_seq bigint not null default 0,
      created_by text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz
    )`.execute(db);
  await sql`create index if not exists boards_workspace_idx on boards (workspace_id) where deleted_at is null`.execute(db);

  await sql`
    create table if not exists items (
      id text primary key,
      board_id text not null references boards(id) on delete cascade,
      key text,
      type text not null,
      parent_id text,
      x double precision not null default 0,
      y double precision not null default 0,
      width double precision not null default 0,
      height double precision not null default 0,
      z_index double precision not null default 0,
      locked boolean not null default false,
      pinned boolean not null default false,
      data jsonb not null default '{}'::jsonb,
      version integer not null default 1,
      created_by text not null,
      updated_by text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz
    )`.execute(db);
  await sql`create index if not exists items_board_idx on items (board_id) where deleted_at is null`.execute(db);
  await sql`create unique index if not exists items_board_key_uq on items (board_id, key) where key is not null and deleted_at is null`.execute(db);

  await sql`
    create table if not exists board_events (
      seq bigserial primary key,
      board_id text not null references boards(id) on delete cascade,
      actor text not null,
      origin text,
      batch_id text not null,
      label text,
      payload jsonb not null,
      created_at timestamptz not null default now()
    )`.execute(db);
  await sql`create index if not exists board_events_board_seq_idx on board_events (board_id, seq)`.execute(db);

  await sql`
    create table if not exists assets (
      id text primary key,
      board_id text not null references boards(id) on delete cascade,
      workspace_id text not null,
      s3_key text not null,
      content_type text not null,
      size integer not null,
      name text not null default '',
      created_by text not null,
      created_at timestamptz not null default now()
    )`.execute(db);
}
