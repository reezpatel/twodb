import { sql } from "kysely";
import { type Kysely } from "@twodb/core-data/db";
import { applyCollabSchema, type CollabRunRow, type CollabTaskRow } from "../collab/schema.js";

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
  /** Owning code_directory (null = legacy/implicit directory). */
  directory_id: string | null;
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
  /** Thinking effort (low|medium|high|max); null = provider default. */
  thinking_level: string | null;
  /** Set when archived (hidden from the default list). */
  archived_at: string | null;
  /** Sidebar badge: "ip" in-progress, "do" done, "at" attention; null = none. */
  marker: string | null;
  created_at: string;
  updated_at: string;
}

/** One run. `/new` and compaction close the current thread and open the next;
 *  the frontend renders messages flat across threads. */
/** A registered project directory: runner + path + per-project config.
 *  Sessions belong to a directory (directory_id) and inherit its space,
 *  default model and project-settings (.agents/.claude/AGENTS.md loading). */
export interface DirectoryRow {
  id: string;
  workspace_id: string;
  space_id: string;
  /** Dispatch runner name hosting the path. */
  runner: string;
  /** Absolute directory path on the runner. */
  path: string;
  /** Display title (defaults to the path basename). */
  title: string;
  /** "<conn>/<model>" default for sessions created in this directory. */
  default_model: string | null;
  /** Serialized { loadAgents: boolean; loadClaude: boolean; loadAgentsMd: boolean }. */
  project_settings_json: string;
  created_at: string;
  updated_at: string;
}

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
  /** Primary space (first of space_ids_json) — kept for legacy queries. */
  space_id: string;
  /** All spaces the agent is visible in (JSON array of ids); "[]" = just space_id. */
  space_ids_json: string;
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
  /** Legacy, unused — availability is decided by scope_*. */
  space_id: string | null;
  /** Legacy, unused. */
  directory: string | null;
  name: string;
  description: string;
  content: string;
  /** Legacy, unused. */
  tags_json: string;
  /** global | agents | spaces | types — see skills.ts. */
  scope_mode: string;
  /** 1 = "all" for the chosen dimension. */
  scope_all: number;
  scope_ids_json: string;
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

/** Git-ref snapshot of the session directory (hidden ref, HEAD untouched). */
export interface CheckpointRow {
  id: string;
  workspace_id: string;
  session_id: string;
  runner: string;
  directory: string;
  label: string | null;
  ref: string;
  commit_sha: string;
  trigger: string;
  created_at: string;
}

/** Inspector payloads. Short-lived (INSPECT_RETENTION_MS) and separate from the transcript. */
export interface InspectBlobRow {
  session_id: string;
  /** sha1 of `content` — identical prompt text is stored once per session. */
  hash: string;
  content: string;
  /** Refreshed every time a round re-uses the blob; retention is measured from here. */
  last_used_at: string;
}
export interface InspectRoundRow {
  id: string;
  session_id: string;
  round: number;
  /** { messages: [{role, hash|null, toolCallId?, toolCalls?}], toolsHash } — content lives in inspect_blob. */
  request_json: string;
  created_at: string;
}

/** Agent memory: a title + content kept at one level (see memory.ts). */
export interface MemoryRow {
  id: string;
  workspace_id: string;
  /** organization | code_directory | self | session */
  level: string;
  directory_id: string | null;
  agent_id: string | null;
  session_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/** Remote MCP server config (http / sse). Not yet injected into agents. */
export interface McpServerRow {
  id: string;
  workspace_id: string;
  name: string;
  url: string;
  /** auto | http | sse */
  transport: string;
  headers_json: string;
  enabled: number;
  /** global | agents | spaces | directories | types — see mcp.ts. */
  scope_mode: string;
  scope_all: number;
  scope_ids_json: string;
  created_at: string;
  updated_at: string;
}

/** Workspace-wide key/value settings (e.g. the global instruction). */
export interface WorkspaceSettingRow {
  workspace_id: string;
  key: string;
  value: string;
  updated_at: string;
}

/** Artisan owns canvas metadata; content stays in the backing app (Paintress). */
export interface CanvasRow {
  id: string;
  workspace_id: string;
  /** Directory-agent canvases belong to one session. */
  session_id: string | null;
  /** Configured-agent canvases are shared by that agent across its sessions. */
  agent_id: string | null;
  type: string;
  title: string;
  /** Paintress board id. */
  resource_id: string;
  created_at: string;
  updated_at: string;
}

export interface ArtisanDb {
  canvas: CanvasRow;
  collab_task: CollabTaskRow;
  collab_run: CollabRunRow;
  workspace_setting: WorkspaceSettingRow;
  mcp_server: McpServerRow;
  memory: MemoryRow;
  inspect_blob: InspectBlobRow;
  inspect_round: InspectRoundRow;
  directory: DirectoryRow;
  session: SessionRow;
  thread: ThreadRow;
  message: MessageRow;
  agent: AgentRow;
  skill: SkillRow;
  session_usage: SessionUsageRow;
  checkpoint: CheckpointRow;
}

export async function applySchema(db: Kysely<ArtisanDb>): Promise<void> {
  // Idempotent column adds for pre-existing databases.
  try {
    await db.schema.alterTable("session").addColumn("thinking_level", "text").execute();
  } catch {
    /* column already exists */
  }
  try {
    await db.schema.alterTable("session").addColumn("directory_id", "text").execute();
  } catch {
    /* column already exists */
  }
  try {
    await db.schema.alterTable("session").addColumn("archived_at", "text").execute();
  } catch {
    /* column already exists */
  }
  try {
    await db.schema.alterTable("session").addColumn("marker", "text").execute();
  } catch {
    /* column already exists */
  }
  // TwoDB's provisioner normally creates the schema; self-heal for bare dev DBs. Checked first: the
  // least-privilege app role lacks CREATE on the database, and Postgres checks that BEFORE `IF NOT EXISTS`.
  const exists = await sql<{ n: number }>`select count(*)::int as n from information_schema.schemata where schema_name = 'artisan'`.execute(db as never);
  if (!exists.rows[0]?.n) await sql`create schema artisan`.execute(db as never);

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
    .addColumn("directory_id", "text")
    .addColumn("model", "text", (c) => c.notNull())
    .addColumn("interactive", "boolean", (c) => c.notNull().defaultTo(true))
    .addColumn("agent_id", "text")
    .addColumn("parent_session_id", "text")
    .addColumn("adhoc_prompt", "text")
    .addColumn("depth", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("plan_json", "text")
    .addColumn("thinking_level", "text")
    .addColumn("archived_at", "text")
    .addColumn("marker", "text")
    .addColumn("created_at", "text", (c) => c.notNull())
    .addColumn("updated_at", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("directory")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("space_id", "text", (c) => c.notNull())
    .addColumn("runner", "text", (c) => c.notNull())
    .addColumn("path", "text", (c) => c.notNull())
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("default_model", "text")
    .addColumn("project_settings_json", "text", (c) => c.notNull().defaultTo("{}"))
    .addColumn("created_at", "text", (c) => c.notNull())
    .addColumn("updated_at", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("thread")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("session_id", "text", (c) => c.notNull())
    .addColumn("idx", "integer", (c) => c.notNull())
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
    .addColumn("idx", "integer", (c) => c.notNull())
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
  try {
    await db.schema.alterTable("agent").addColumn("space_ids_json", "text", (c) => c.notNull().defaultTo("[]")).execute();
  } catch {
    /* column already exists */
  }
  await sql`update agent set space_ids_json = '["' || space_id || '"]' where space_ids_json = '[]'`.execute(db);

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
  await sql`alter table skill alter column space_id drop not null`.execute(db);
  for (const [col, build] of [
    ["scope_mode", (c: any) => c.notNull().defaultTo("spaces")],
    ["scope_all", (c: any) => c.notNull().defaultTo(0)],
    ["scope_ids_json", (c: any) => c.notNull().defaultTo("[]")],
  ] as const) {
    try {
      await db.schema.alterTable("skill").addColumn(col, col === "scope_all" ? "integer" : "text", build).execute();
      if (col === "scope_ids_json") await sql`update skill set scope_ids_json = '["' || space_id || '"]'`.execute(db);
    } catch {
      /* column already exists */
    }
  }

  await db.schema
    .createTable("canvas")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("session_id", "text")
    .addColumn("agent_id", "text")
    .addColumn("type", "text", (c) => c.notNull())
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("resource_id", "text", (c) => c.notNull())
    .addColumn("created_at", "text", (c) => c.notNull())
    .addColumn("updated_at", "text", (c) => c.notNull())
    .execute();
  await db.schema.createIndex("canvas_session_idx").ifNotExists().on("canvas").columns(["workspace_id", "session_id"]).execute();
  await db.schema.createIndex("canvas_agent_idx").ifNotExists().on("canvas").columns(["workspace_id", "agent_id"]).execute();
  await db.schema.createIndex("canvas_resource_idx").ifNotExists().on("canvas").column("resource_id").unique().execute();

  await db.schema
    .createTable("checkpoint")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("session_id", "text", (c) => c.notNull())
    .addColumn("runner", "text", (c) => c.notNull())
    .addColumn("directory", "text", (c) => c.notNull())
    .addColumn("label", "text")
    .addColumn("ref", "text", (c) => c.notNull())
    .addColumn("commit_sha", "text", (c) => c.notNull())
    .addColumn("trigger", "text", (c) => c.notNull().defaultTo("manual"))
    .addColumn("created_at", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("inspect_blob")
    .ifNotExists()
    .addColumn("session_id", "text", (c) => c.notNull())
    .addColumn("hash", "text", (c) => c.notNull())
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("last_used_at", "text", (c) => c.notNull())
    .addPrimaryKeyConstraint("inspect_blob_pk", ["session_id", "hash"])
    .execute();
  await db.schema
    .createTable("inspect_round")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("session_id", "text", (c) => c.notNull())
    .addColumn("round", "integer", (c) => c.notNull())
    .addColumn("request_json", "text", (c) => c.notNull())
    .addColumn("created_at", "text", (c) => c.notNull())
    .execute();
  await db.schema.createIndex("inspect_round_session_idx").ifNotExists().on("inspect_round").columns(["session_id", "created_at"]).execute();
  await db.schema.createIndex("inspect_round_created_idx").ifNotExists().on("inspect_round").column("created_at").execute();
  // idx was created as text: `order by idx` then sorted "0,1,10,11,…,2" and, once a thread passed
  // 10 messages, rebuilt history out of order (the newest user message landed mid-history).
  for (const table of ["message", "thread"] as const) {
    const col = await sql<{ data_type: string }>`select data_type from information_schema.columns where table_schema = current_schema() and table_name = ${table} and column_name = 'idx'`.execute(db);
    if (col.rows[0] && col.rows[0].data_type !== "integer") {
      await sql.raw(`alter table ${table} alter column idx type integer using idx::integer`).execute(db);
    }
  }
  await db.schema.createIndex("message_thread_idx").ifNotExists().on("message").columns(["thread_id", "idx"]).execute();
  await db.schema
    .createTable("workspace_setting")
    .ifNotExists()
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("key", "text", (c) => c.notNull())
    .addColumn("value", "text", (c) => c.notNull())
    .addColumn("updated_at", "text", (c) => c.notNull())
    .addPrimaryKeyConstraint("workspace_setting_pk", ["workspace_id", "key"])
    .execute();
  await applyCollabSchema(db as never);
  await db.schema
    .createTable("mcp_server")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("url", "text", (c) => c.notNull())
    .addColumn("transport", "text", (c) => c.notNull().defaultTo("auto"))
    .addColumn("headers_json", "text", (c) => c.notNull().defaultTo("{}"))
    .addColumn("enabled", "integer", (c) => c.notNull().defaultTo(1))
    .addColumn("scope_mode", "text", (c) => c.notNull().defaultTo("global"))
    .addColumn("scope_all", "integer", (c) => c.notNull().defaultTo(1))
    .addColumn("scope_ids_json", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("created_at", "text", (c) => c.notNull())
    .addColumn("updated_at", "text", (c) => c.notNull())
    .execute();
  await db.schema.createIndex("mcp_server_workspace_idx").ifNotExists().on("mcp_server").column("workspace_id").execute();
  await db.schema
    .createTable("memory")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("level", "text", (c) => c.notNull())
    .addColumn("directory_id", "text")
    .addColumn("agent_id", "text")
    .addColumn("session_id", "text")
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("created_at", "text", (c) => c.notNull())
    .addColumn("updated_at", "text", (c) => c.notNull())
    .execute();
  await db.schema.createIndex("memory_workspace_idx").ifNotExists().on("memory").columns(["workspace_id", "level"]).execute();
  await db.schema.createIndex("inspect_blob_used_idx").ifNotExists().on("inspect_blob").column("last_used_at").execute();

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
