import { sql, type Kysely } from "@twodb/core-data/db";

/** Loosely-typed handle: rows are snake_case, mapped to camelCase at the API edge (lib/rows.ts). */
export type Db = Kysely<any>;

export const STATUS_CATEGORIES = ["backlog", "todo", "in_progress", "done", "canceled"] as const;
export const PRIORITIES = ["urgent", "high", "medium", "low"] as const;
export const EPIC_STATUSES = ["proposed", "planned", "active", "completed", "canceled"] as const;
export const LINK_RELATIONS = ["blocks", "relates_to", "duplicates"] as const;

/**
 * One schema per app (provisioned by TwoDB). Hierarchy:
 *   workspace (from gateway) -> space -> project -> epics / milestones / tickets
 * Everything below `project` is scoped by project_id; project carries workspace_id + space_id.
 * ids are ULIDs (text). Idempotent: safe to run on every boot.
 */
const DDL = `
create table if not exists project (
  id text primary key,
  workspace_id text not null,
  space_id text not null,
  key text not null,
  name text not null,
  description text not null default '',
  icon text,
  next_sequence integer not null default 1,
  points_estimate_enabled boolean not null default true,
  time_estimate_enabled boolean not null default false,
  subtasks_enabled boolean not null default true,
  checklists_enabled boolean not null default true,
  archived_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key)
);
create index if not exists project_space_idx on project (space_id);

create table if not exists status (
  id text primary key,
  project_id text not null references project(id) on delete cascade,
  name text not null,
  color text not null default '#9ca3af',
  category text not null check (category in ('backlog','todo','in_progress','done','canceled')),
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists status_project_idx on status (project_id, position);

create table if not exists ticket_type (
  id text primary key,
  project_id text not null references project(id) on delete cascade,
  name text not null,
  icon text not null default 'circle-dot',
  color text not null default '#6b7280',
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ticket_type_project_idx on ticket_type (project_id, position);

create table if not exists label_group (
  id text primary key,
  project_id text not null references project(id) on delete cascade,
  name text not null,
  position double precision not null default 0
);
create index if not exists label_group_project_idx on label_group (project_id);

create table if not exists label (
  id text primary key,
  project_id text not null references project(id) on delete cascade,
  group_id text references label_group(id) on delete set null,
  name text not null,
  color text not null default '#6b7280',
  created_at timestamptz not null default now(),
  unique (project_id, name)
);

create table if not exists epic (
  id text primary key,
  project_id text not null references project(id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'planned' check (status in ('proposed','planned','active','completed','canceled')),
  owner_user_id text,
  priority text,
  start_date date,
  target_date date,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists epic_project_idx on epic (project_id, position);

create table if not exists epic_label (
  epic_id text not null references epic(id) on delete cascade,
  label_id text not null references label(id) on delete cascade,
  primary key (epic_id, label_id)
);

create table if not exists milestone (
  id text primary key,
  project_id text not null references project(id) on delete cascade,
  name text not null,
  goal text not null default '',
  start_date date not null,
  end_date date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists milestone_project_idx on milestone (project_id, start_date);

create table if not exists ticket (
  id text primary key,
  project_id text not null references project(id) on delete cascade,
  sequence_number integer not null,
  type_id text references ticket_type(id) on delete set null,
  epic_id text references epic(id) on delete set null,
  milestone_id text references milestone(id) on delete set null,
  status_id text not null references status(id),
  parent_id text references ticket(id) on delete set null,
  assignee_user_id text,
  title text not null,
  description text not null default '',
  priority text,
  estimate_points numeric,
  estimate_minutes integer,
  start_date date,
  due_date date,
  position double precision not null default 0,
  archived_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, sequence_number)
);
create index if not exists ticket_project_idx on ticket (project_id, status_id, position);
create index if not exists ticket_epic_idx on ticket (epic_id);
create index if not exists ticket_milestone_idx on ticket (milestone_id);
create index if not exists ticket_parent_idx on ticket (parent_id);
create index if not exists ticket_assignee_idx on ticket (assignee_user_id);

create table if not exists ticket_label (
  ticket_id text not null references ticket(id) on delete cascade,
  label_id text not null references label(id) on delete cascade,
  primary key (ticket_id, label_id)
);

create table if not exists ticket_link (
  id text primary key,
  source_ticket_id text not null references ticket(id) on delete cascade,
  target_ticket_id text not null references ticket(id) on delete cascade,
  relation text not null check (relation in ('blocks','relates_to','duplicates')),
  created_at timestamptz not null default now(),
  check (source_ticket_id <> target_ticket_id),
  unique (source_ticket_id, target_ticket_id, relation)
);
create index if not exists ticket_link_target_idx on ticket_link (target_ticket_id);

create table if not exists ticket_watcher (
  ticket_id text not null references ticket(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (ticket_id, user_id)
);

create table if not exists ticket_checklist (
  id text primary key,
  ticket_id text not null references ticket(id) on delete cascade,
  title text not null,
  position double precision not null default 0
);
create index if not exists ticket_checklist_ticket_idx on ticket_checklist (ticket_id, position);

create table if not exists ticket_checklist_item (
  id text primary key,
  checklist_id text not null references ticket_checklist(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  position double precision not null default 0
);
create index if not exists ticket_checklist_item_idx on ticket_checklist_item (checklist_id, position);

create table if not exists ticket_comment (
  id text primary key,
  ticket_id text not null references ticket(id) on delete cascade,
  user_id text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ticket_comment_ticket_idx on ticket_comment (ticket_id, created_at);

create table if not exists ticket_activity (
  id text primary key,
  ticket_id text not null references ticket(id) on delete cascade,
  user_id text,
  action text not null,
  field text,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);
create index if not exists ticket_activity_ticket_idx on ticket_activity (ticket_id, created_at);

create table if not exists ticket_attachment (
  id text primary key,
  ticket_id text not null references ticket(id) on delete cascade,
  storage_key text not null,
  file_name text not null,
  content_type text not null,
  size integer not null,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index if not exists ticket_attachment_ticket_idx on ticket_attachment (ticket_id);

create table if not exists custom_field (
  id text primary key,
  project_id text not null references project(id) on delete cascade,
  name text not null,
  type text not null check (type in ('text','number','date','select','checkbox','url')),
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists custom_field_project_idx on custom_field (project_id, position);

create table if not exists custom_field_option (
  id text primary key,
  field_id text not null references custom_field(id) on delete cascade,
  label text not null,
  color text not null default '#6b7280',
  position double precision not null default 0
);

create table if not exists ticket_field_value (
  ticket_id text not null references ticket(id) on delete cascade,
  field_id text not null references custom_field(id) on delete cascade,
  value jsonb,
  primary key (ticket_id, field_id)
);

create table if not exists ticket_dev_link (
  id text primary key,
  ticket_id text not null references ticket(id) on delete cascade,
  provider text not null default 'github',
  kind text not null default 'pull_request' check (kind in ('pull_request','branch','commit')),
  url text not null,
  title text not null default '',
  state text not null default 'open' check (state in ('open','draft','merged','closed')),
  ci_state text check (ci_state in ('pending','success','failure')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ticket_dev_link_ticket_idx on ticket_dev_link (ticket_id);

create table if not exists project_view (
  id text primary key,
  project_id text not null references project(id) on delete cascade,
  name text not null,
  layout text not null default 'table' check (layout in ('table','board','timeline')),
  filters jsonb not null default '{}',
  sort_by text not null default 'position',
  sort_dir text not null default 'asc',
  group_by text,
  owner_user_id text,
  shared boolean not null default true,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_view_project_idx on project_view (project_id, position);

create table if not exists project_document (
  id text primary key,
  project_id text not null references project(id) on delete cascade,
  kind text not null default 'doc' check (kind in ('doc','note')),
  parent_id text references project_document(id) on delete set null,
  title text not null,
  content text not null default '',
  created_by text,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_document_project_idx on project_document (project_id, kind, position);

create table if not exists project_document_ticket (
  document_id text not null references project_document(id) on delete cascade,
  ticket_id text not null references ticket(id) on delete cascade,
  primary key (document_id, ticket_id)
);

create table if not exists dashboard (
  id text primary key,
  project_id text not null references project(id) on delete cascade,
  name text not null,
  widgets jsonb not null default '[]',
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dashboard_project_idx on dashboard (project_id, position);

create table if not exists ticket_template (
  id text primary key,
  project_id text not null references project(id) on delete cascade,
  name text not null,
  title text not null default '',
  description text not null default '',
  type_id text references ticket_type(id) on delete set null,
  priority text,
  label_ids jsonb not null default '[]',
  checklist jsonb not null default '[]',
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ticket_template_project_idx on ticket_template (project_id, position);

create table if not exists project_template (
  id text primary key,
  workspace_id text not null,
  name text not null,
  description text not null default '',
  config jsonb not null default '{}',
  created_by text,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists notification (
  id text primary key,
  workspace_id text not null,
  user_id text not null,
  actor_user_id text,
  ticket_id text references ticket(id) on delete cascade,
  kind text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notification_user_idx on notification (workspace_id, user_id, created_at desc);

create table if not exists share_link (
  id text primary key,
  token text not null unique,
  project_id text not null references project(id) on delete cascade,
  ticket_id text references ticket(id) on delete cascade,
  created_by text,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists share_link_project_idx on share_link (project_id);

create table if not exists user_preference (
  workspace_id text not null,
  user_id text not null,
  key text not null,
  value jsonb not null default '{}',
  primary key (workspace_id, user_id, key)
);
`;

export async function applySchema(db: Db): Promise<void> {
  await sql.raw(DDL).execute(db);
}
