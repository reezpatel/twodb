import { type Kysely } from "@twodb/core-data/db";

/** A run context: a directory on a runner, inside a space. Sessions of the
 *  same directory share the space (skills, connectors, agent matching). */
export interface SessionRow {
  id: string;
  workspace_id: string;
  space_id: string;
  /** "directory" = the webapp's default; any other string = app-typed
   *  (hidden from the default list, reachable by id). */
  type: string;
  title: string;
  /** Dispatch runner name (must be online for tools to run). */
  runner: string;
  /** Absolute directory path on the runner; every file/exec tool runs with
   *  cwd=directory. */
  directory: string;
  /** "<conn>/<model>" TwoRoute id. */
  model: string;
  /** ask_user works only when true (viewers on the workspace WS). */
  interactive: boolean;
  /** Agent config id when bound to a custom agent; null = directory agent. */
  agent_id: string | null;
  /** Parent session for invoke_subagent children. */
  parent_session_id: string | null;
  /** Ad-hoc child prompt (invoke_subagent without agent_id). */
  adhoc_prompt: string | null;
  /** Depth of nesting from the root directory session (cap 3). */
  depth: number;
  /** Serialized plan: [{description, status}] — get_plan/update_plan. */
  plan_json: string | null;
  created_at: string;
  updated_at: string;
}

/** One run. `/new` and compaction close the current thread and open the next;
 *  the frontend renders messages flat across threads. */
export interface ThreadRow {
  id: string;
  session_id: string;
  idx: number;
  /** Previous thread's compaction summary, if it ended compacted — replayed
   *  as the opening context of this thread. */
  summary: string | null;
  created_at: string;
  closed_at: string | null;
}

/** role: "user" | "assistant" | "compaction" | "system".
 *  Tool calls/results are serialized into meta_json on assistant/user rows. */
export interface MessageRow {
  id: string;
  thread_id: string;
  session_id: string;
  idx: number;
  role: string;
  content: string;
  meta_json: string;
  created_at: string;
}

/** Custom agents (sub_agent | persona | collaborator | any custom string).
 *  Directory agents are rows with type "directory" pinned to runner+directory. */
export interface AgentRow {
  id: string;
  workspace_id: string;
  space_id: string;
  type: string;
  name: string;
  description: string;
  instruction: string;
  /** "<conn>/<model>"; null = inherit caller's model. */
  model: string | null;
  /** Tool allowlist (JSON array); null/empty = full belt. */
  tools_json: string;
  /** Skill tags (JSON array) — tag matching like legacy: "default" or ∩. */
  skill_tags_json: string;
  /** Tags for session-tag matching of agent visibility. */
  tags_json: string;
  /** Personas may pin their own runner+directory. */
  runner: string | null;
  directory: string | null;
  created_at: string;
  updated_at: string;
}

/** Space-scoped skill with optional directory pin. Visible to a session when
 *  same space AND (directory null or equal) AND tag match. */
export interface SkillRow {
  id: string;
  workspace_id: string;
  space_id: string;
  directory: string | null;
  name: string;
  description: string;
  content: string;
  tags_json: string;
  created_at: string;
  updated_at: string;
}

/** One row per session, incremented at every round finish — O(1) reads for
 *  the chat footer, no aggregation queries. TwoRoute usage_log stays the
 *  billing system of record. */
export interface SessionUsageRow {
  session_id: string;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  calls: number;
  cost_usd: number | null;
  updated_at: string;
}

export interface ArtisanDb {
  session: SessionRow;
  thread: ThreadRow;
  message: MessageRow;
  agent: AgentRow;
  skill: SkillRow;
  session_usage: SessionUsageRow;
}

export async function applySchema(db: Kysely<ArtisanDb>): Promise<void> {
  await db.schema.createSchema("artisan").ifNotExists().execute();

  await db.schema
    .createTable("session")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("space_id", "text", (c) => c.notNull())
    .addColumn("type", "text", (c) => c.notNull().defaultTo("directory"))
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("runner", "text", (c) => c.notNull())
    .addColumn("directory", "text", (c) => c.notNull())
    .addColumn("model", "text", (c) => c.notNull())
    .addColumn("interactive", "boolean", (c) => c.notNull().defaultTo(true))
    .addColumn("agent_id", "text")
    .addColumn("parent_session_id", "text")
    .addColumn("adhoc_prompt", "text")
    .addColumn("depth", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("plan_json", "text")
    .addColumn("created_at", "text", (c) => c.notNull())
    .addColumn("updated_at", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("thread")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("session_id", "text", (c) => c.notNull())
    .addColumn("idx", "text", (c) => c.notNull())
    .addColumn("summary", "text")
    .addColumn("created_at", "text", (c) => c.notNull())
    .addColumn("closed_at", "text")
    .execute();

  await db.schema
    .createTable("message")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("thread_id", "text", (c) => c.notNull())
    .addColumn("session_id", "text", (c) => c.notNull())
    .addColumn("idx", "text", (c) => c.notNull())
    .addColumn("role", "text", (c) => c.notNull())
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("meta_json", "text", (c) => c.notNull().defaultTo("{}"))
    .addColumn("created_at", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("agent")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("space_id", "text", (c) => c.notNull())
    .addColumn("type", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("instruction", "text", (c) => c.notNull())
    .addColumn("model", "text")
    .addColumn("tools_json", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("skill_tags_json", "text", (c) => c.notNull().defaultTo('["default"]'))
    .addColumn("tags_json", "text", (c) => c.notNull().defaultTo('["default"]'))
    .addColumn("runner", "text")
    .addColumn("directory", "text")
    .addColumn("created_at", "text", (c) => c.notNull())
    .addColumn("updated_at", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("skill")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("space_id", "text", (c) => c.notNull())
    .addColumn("directory", "text")
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text", (c) => c.notNull())
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("tags_json", "text", (c) => c.notNull().defaultTo('["default"]'))
    .addColumn("created_at", "text", (c) => c.notNull())
    .addColumn("updated_at", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("session_usage")
    .ifNotExists()
    .addColumn("session_id", "text", (c) => c.primaryKey())
    .addColumn("input_tokens", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("output_tokens", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("cached_tokens", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("calls", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("cost_usd", "double precision")
    .addColumn("updated_at", "text", (c) => c.notNull())
    .execute();
}
