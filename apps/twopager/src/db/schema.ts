import { sql, type Kysely } from "@twodb/core-data/db";

export type Db = Kysely<any>;

/**
 * One schema per app (provisioned by TwoDB). A site belongs to a space; every table carries workspace_id.
 * Versions are immutable once finalized (like Firebase Hosting releases); `site.active_version_id` is the live one.
 * Blobs live in S3 at `sites/<site_id>/<sha256>` (content-addressed, shared between versions of a site).
 * Idempotent: safe to run on every boot.
 */
const DDL = `
create table if not exists site (
  id text primary key,
  workspace_id text not null,
  space_id text not null,
  name text not null,
  slug text not null unique,
  active_version_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists site_space_idx on site (workspace_id, space_id);

create table if not exists site_domain (
  host text primary key,
  site_id text not null references site(id) on delete cascade,
  workspace_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists site_domain_site_idx on site_domain (site_id);

create table if not exists site_version (
  id text primary key,
  site_id text not null references site(id) on delete cascade,
  workspace_id text not null,
  number integer not null,
  status text not null default 'draft' check (status in ('draft','final')),
  message text,
  config jsonb not null default '{}'::jsonb,
  file_count integer not null default 0,
  total_bytes bigint not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  unique (site_id, number)
);

create table if not exists site_file (
  version_id text not null references site_version(id) on delete cascade,
  site_id text not null,
  path text not null,
  sha256 text not null,
  size bigint not null,
  content_type text not null,
  primary key (version_id, path)
);
create index if not exists site_file_blob_idx on site_file (site_id, sha256);
`;

export async function applySchema(db: Db): Promise<void> {
  await sql.raw(DDL).execute(db);
}
