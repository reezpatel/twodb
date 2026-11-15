import { sql, type Kysely } from "@twodb/core-data/db";

/** Loosely-typed handle: rows are snake_case, mapped to camelCase at the API edge (lib/rows.ts). */
export type Db = Kysely<any>;

export const ACCOUNT_TYPES = ["bank", "cash", "upi", "credit_card", "wallet", "other"] as const;
export const TXN_KINDS = ["expense", "income", "transfer"] as const;
export const ASSET_CLASSES = [
  "stock", "mutual_fund", "etf", "gold", "silver", "platinum", "fd", "rd", "ppf", "epf", "nps", "bond", "crypto", "real_estate", "other",
] as const;
export const LIABILITY_KINDS = ["home_loan", "car_loan", "personal_loan", "education_loan", "credit_card", "other"] as const;
export const PAY_METHODS = ["upi", "card", "cash", "netbanking", "cheque", "auto_debit", "other"] as const;

/**
 * One schema per app (provisioned by TwoDB). Hierarchy: workspace (gateway) -> space -> everything else.
 * Every table carries workspace_id + space_id; a space is a fully isolated "book".
 * ids are ULIDs (text). Idempotent: safe to run on every boot.
 */
const DDL = `
create table if not exists space_setting (
  space_id text primary key,
  workspace_id text not null,
  currency text not null default 'INR',
  networth_target numeric(16,2),
  seeded boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists account (
  id text primary key,
  workspace_id text not null,
  space_id text not null,
  name text not null,
  type text not null check (type in ('bank','cash','upi','credit_card','wallet','other')),
  institution text,
  opening_balance numeric(16,2) not null default 0,
  credit_limit numeric(16,2),
  statement_day integer,
  due_day integer,
  color text not null default '#6366f1',
  include_in_networth boolean not null default true,
  archived_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists account_space_idx on account (workspace_id, space_id);

create table if not exists category (
  id text primary key,
  workspace_id text not null,
  space_id text not null,
  name text not null,
  kind text not null check (kind in ('expense','income')),
  color text not null default '#9ca3af',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (space_id, kind, name)
);
create index if not exists category_space_idx on category (workspace_id, space_id);

create table if not exists envelope (
  id text primary key,
  workspace_id text not null,
  space_id text not null,
  name text not null,
  color text not null default '#10b981',
  target numeric(16,2),
  monthly_fill numeric(16,2),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists envelope_space_idx on envelope (workspace_id, space_id);

create table if not exists txn (
  id text primary key,
  workspace_id text not null,
  space_id text not null,
  account_id text not null references account(id) on delete restrict,
  kind text not null check (kind in ('expense','income','transfer')),
  amount numeric(16,2) not null check (amount > 0),
  date date not null,
  category_id text references category(id) on delete set null,
  to_account_id text references account(id) on delete restrict,
  payee text,
  note text,
  method text,
  tags text[] not null default '{}',
  envelope_id text references envelope(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists txn_space_date_idx on txn (workspace_id, space_id, date desc);
create index if not exists txn_account_idx on txn (account_id);
create index if not exists txn_category_idx on txn (category_id);
create index if not exists txn_envelope_idx on txn (envelope_id);

create table if not exists budget (
  id text primary key,
  workspace_id text not null,
  space_id text not null,
  category_id text not null references category(id) on delete cascade,
  amount numeric(16,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (space_id, category_id)
);

create table if not exists envelope_alloc (
  id text primary key,
  workspace_id text not null,
  space_id text not null,
  envelope_id text not null references envelope(id) on delete cascade,
  amount numeric(16,2) not null,
  date date not null default current_date,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists envelope_alloc_idx on envelope_alloc (envelope_id);

create table if not exists goal (
  id text primary key,
  workspace_id text not null,
  space_id text not null,
  name text not null,
  kind text not null default 'savings',
  target_amount numeric(16,2) not null check (target_amount > 0),
  target_date date,
  color text not null default '#f59e0b',
  note text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists goal_space_idx on goal (workspace_id, space_id);

create table if not exists goal_contribution (
  id text primary key,
  workspace_id text not null,
  space_id text not null,
  goal_id text not null references goal(id) on delete cascade,
  amount numeric(16,2) not null,
  date date not null default current_date,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists goal_contribution_idx on goal_contribution (goal_id);

create table if not exists holding (
  id text primary key,
  workspace_id text not null,
  space_id text not null,
  asset_class text not null,
  name text not null,
  symbol text,
  institution text,
  quantity numeric(20,6) not null default 0,
  avg_cost numeric(16,4) not null default 0,
  current_price numeric(16,4),
  principal numeric(16,2),
  current_value numeric(16,2),
  interest_rate numeric(7,3),
  compounding integer not null default 4,
  installment numeric(16,2),
  start_date date,
  maturity_date date,
  unit text,
  retirement boolean not null default false,
  note text,
  price_updated_at timestamptz,
  archived_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists holding_space_idx on holding (workspace_id, space_id);

create table if not exists holding_trade (
  id text primary key,
  workspace_id text not null,
  space_id text not null,
  holding_id text not null references holding(id) on delete cascade,
  side text not null check (side in ('buy','sell')),
  quantity numeric(20,6) not null check (quantity > 0),
  price numeric(16,4) not null check (price >= 0),
  fees numeric(16,2) not null default 0,
  date date not null default current_date,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists holding_trade_idx on holding_trade (holding_id, date desc);

create table if not exists liability (
  id text primary key,
  workspace_id text not null,
  space_id text not null,
  name text not null,
  kind text not null default 'other',
  principal numeric(16,2) not null default 0,
  outstanding numeric(16,2) not null default 0,
  interest_rate numeric(7,3),
  emi numeric(16,2),
  start_date date,
  end_date date,
  note text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists liability_space_idx on liability (workspace_id, space_id);

create table if not exists networth_snapshot (
  space_id text not null,
  workspace_id text not null,
  date date not null,
  assets numeric(18,2) not null,
  liabilities numeric(18,2) not null,
  net_worth numeric(18,2) not null,
  breakdown jsonb not null default '{}',
  primary key (space_id, date)
);

create table if not exists retirement_plan (
  space_id text primary key,
  workspace_id text not null,
  current_age integer not null default 30,
  retirement_age integer not null default 60,
  life_expectancy integer not null default 85,
  monthly_expense numeric(16,2) not null default 50000,
  inflation numeric(6,3) not null default 6,
  pre_return numeric(6,3) not null default 11,
  post_return numeric(6,3) not null default 8,
  monthly_saving numeric(16,2) not null default 20000,
  step_up numeric(6,3) not null default 5,
  other_corpus numeric(16,2) not null default 0,
  updated_at timestamptz not null default now()
);
`;

export async function applySchema(db: Db): Promise<void> {
  await sql.raw(DDL).execute(db);
}
