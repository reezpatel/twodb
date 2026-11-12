import { sql, type Kysely } from "@twodb/core-data/db";

/**
 * TwoDoo's single Postgres schema ("twodoo", provisioned by TwoDB).
 * Snake_case columns (kysely convention here matches twochat/tworoute).
 *
 * Hierarchy: Space (platform-level, forwarded by the gateway) → Board
 * (nestable folder, parent_board_id null = root of its space) → List (leaf
 * task container) → Task. Tasks carry an optional TipTap description,
 * checklist items, time bounds, priority, tags, recurrence and (v2) a habit
 * link. Single-user per space in v1, but assignee_user_id is reserved.
 */

export type TaskStatus = "open" | "done" | "trashed";
export type Priority = "none" | "low" | "medium" | "high" | "urgent";
export type HabitSchedule = "daily" | "weekly" | "interval" | "monthly";
export type HabitDirection = "build" | "quit";

export interface BoardRow {
  id: string;
  workspace_id: string;
  space_id: string;
  parent_board_id: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  position: number;
  collapsed: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListRow {
  id: string;
  workspace_id: string;
  space_id: string;
  board_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  workspace_id: string;
  space_id: string;
  list_id: string;
  parent_task_id: string | null;
  title: string;
  /** TipTap-generated HTML (sanitized client-side on render). */
  description_html: string | null;
  status: TaskStatus;
  priority: Priority;
  /** Planned start (null = undated). All-day tasks keep calendar-day bounds. */
  start_at: string | null;
  end_at: string | null;
  all_day: boolean;
  recurrence_rule: string | null;
  /** Precomputed next occurrence start — drives the smart lists. */
  recurrence_next_at: string | null;
  habit_id: string | null;
  completed_at: string | null;
  /** Reserved for multi-user v2; inert while single-user. */
  assignee_user_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItemRow {
  id: string;
  workspace_id: string;
  task_id: string;
  content: string;
  checked: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TagRow {
  id: string;
  workspace_id: string;
  space_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface TaskTagRow {
  task_id: string;
  tag_id: string;
}

export interface HabitRow {
  id: string;
  workspace_id: string;
  space_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  schedule: HabitSchedule;
  /** For interval schedules: check in every N days. */
  interval_days: number | null;
  /** Weekly schedules: which weekdays (0=Sun…6=Sat) — empty = every day. */
  by_weekday: number[] | null;
  /** Times per period the habit should be logged (default 1). */
  target_count: number;
  /** Streak goal in days; null = no explicit goal. */
  goal_streak: number | null;
  direction: HabitDirection;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HabitLogRow {
  id: string;
  workspace_id: string;
  habit_id: string;
  /** Calendar day (YYYY-MM-DD, user-local when written). */
  log_date: string;
  count: number;
  note: string | null;
  created_at: string;
}

export interface TwoDooDb {
  board: BoardRow;
  list: ListRow;
  task: TaskRow;
  checklist_item: ChecklistItemRow;
  tag: TagRow;
  task_tag: TaskTagRow;
  habit: HabitRow;
  habit_log: HabitLogRow;
}

const now = sql`now()`;

export async function applySchema(db: Kysely<TwoDooDb>): Promise<void> {
  await db.schema
    .createTable("board")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("space_id", "text", (c) => c.notNull())
    .addColumn("parent_board_id", "text")
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("color", "text")
    .addColumn("icon", "text")
    .addColumn("position", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("collapsed", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("archived_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema.createIndex("board_space_parent_idx").ifNotExists().on("board").columns(["space_id", "parent_board_id", "position"]).execute();
  await db.schema.createIndex("board_workspace_idx").ifNotExists().on("board").columns(["workspace_id"]).execute();

  await db.schema
    .createTable("list")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("space_id", "text", (c) => c.notNull())
    .addColumn("board_id", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("color", "text")
    .addColumn("icon", "text")
    .addColumn("position", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("archived_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema.createIndex("list_board_idx").ifNotExists().on("list").columns(["board_id", "position"]).execute();
  await db.schema.createIndex("list_space_idx").ifNotExists().on("list").columns(["space_id"]).execute();

  await db.schema
    .createTable("task")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("space_id", "text", (c) => c.notNull())
    .addColumn("list_id", "text", (c) => c.notNull())
    .addColumn("parent_task_id", "text")
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("description_html", "text")
    .addColumn("status", "text", (c) => c.notNull().defaultTo("open"))
    .addColumn("priority", "text", (c) => c.notNull().defaultTo("none"))
    .addColumn("start_at", "timestamptz")
    .addColumn("end_at", "timestamptz")
    .addColumn("all_day", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("recurrence_rule", "text")
    .addColumn("recurrence_next_at", "timestamptz")
    .addColumn("habit_id", "text")
    .addColumn("completed_at", "timestamptz")
    .addColumn("assignee_user_id", "text")
    .addColumn("position", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema.createIndex("task_list_pos_idx").ifNotExists().on("task").columns(["list_id", "status", "position"]).execute();
  await db.schema.createIndex("task_space_status_idx").ifNotExists().on("task").columns(["space_id", "status", "start_at"]).execute();
  await db.schema.createIndex("task_parent_idx").ifNotExists().on("task").columns(["parent_task_id"]).execute();
  await db.schema.createIndex("task_habit_idx").ifNotExists().on("task").columns(["habit_id"]).execute();

  await db.schema
    .createTable("checklist_item")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("task_id", "text", (c) => c.notNull())
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("checked", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("position", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema.createIndex("checklist_task_idx").ifNotExists().on("checklist_item").columns(["task_id", "position"]).execute();

  await db.schema
    .createTable("tag")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("space_id", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("color", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema.createIndex("tag_space_name_idx").ifNotExists().on("tag").columns(["space_id", "name"]).execute();

  await db.schema
    .createTable("task_tag")
    .ifNotExists()
    .addColumn("task_id", "text", (c) => c.notNull())
    .addColumn("tag_id", "text", (c) => c.notNull())
    .addPrimaryKeyConstraint("task_tag_pkey", ["task_id", "tag_id"])
    .execute();
  await db.schema.createIndex("task_tag_task_idx").ifNotExists().on("task_tag").columns(["task_id"]).execute();
  await db.schema.createIndex("task_tag_tag_idx").ifNotExists().on("task_tag").columns(["tag_id"]).execute();

  await db.schema
    .createTable("habit")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("space_id", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("color", "text")
    .addColumn("icon", "text")
    .addColumn("schedule", "text", (c) => c.notNull().defaultTo("daily"))
    .addColumn("interval_days", "integer")
    .addColumn("by_weekday", sql`integer[]`)
    .addColumn("target_count", "integer", (c) => c.notNull().defaultTo(1))
    .addColumn("goal_streak", "integer")
    .addColumn("direction", "text", (c) => c.notNull().defaultTo("build"))
    .addColumn("archived_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema.createIndex("habit_space_idx").ifNotExists().on("habit").columns(["space_id"]).execute();

  await db.schema
    .createTable("habit_log")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("habit_id", "text", (c) => c.notNull())
    .addColumn("log_date", "text", (c) => c.notNull())
    .addColumn("count", "integer", (c) => c.notNull().defaultTo(1))
    .addColumn("note", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema.createIndex("habit_log_habit_date_idx").ifNotExists().on("habit_log").columns(["habit_id", "log_date"]).execute();
}
