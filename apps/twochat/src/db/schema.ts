import { sql, type Kysely } from "@twodb/core-data/db";
import { applyCollabSchema, type CollabRunRow, type CollabTaskRow } from "../collab/schema.js";

/**
 * TwoChat's single Postgres schema ("twochat", provisioned by TwoDB).
 * Snake_case columns (kysely convention here matches tworoute/artisan).
 *
 * Actor model: humans are `user_id` (gateway-resolved), bots/agents are
 * `bot_id` rows in `bot` — the app-local registry of machine participants
 * (workspace API keys acting for agents). Channels: `kind` ∈ channel|dm;
 * DMs derive their title client-side from the other members.
 */

export interface ChannelRow {
  id: string;
  workspace_id: string;
  /** Isolated top-level conversation list containing this conversation. */
  list_id: string | null;
  kind: "channel" | "dm";
  name: string;
  topic: string | null;
  is_read_only: boolean;
  source_provider: string | null;
  source_external_id: string | null;
  source_url: string | null;
  avatar_url: string | null;
  /** Only for kind=dm: the two (or few) member actor ids, stable-sorted, for uniqueness. */
  dm_key: string | null;
  created_by: string | null;
  /** Actor id string "user:<id>" | "bot:<id>" — see actors.ts. */
  created_by_type: "user" | "bot";
  position: number;
  last_message_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelMemberRow {
  id: string;
  workspace_id: string;
  channel_id: string;
  member_type: "user" | "bot";
  user_id: string | null;
  bot_id: string | null;
  role: "member" | "admin";
  /** bot members with respond_to_mentions/reply participate as agents. */
  joined_at: string;
}

export interface MessageRow {
  id: string;
  workspace_id: string;
  channel_id: string;
  author_type: "user" | "bot";
  user_id: string | null;
  bot_id: string | null;
  /** Snapshots used by imported/read-only conversations. */
  author_name: string | null;
  author_avatar_url: string | null;
  external_id: string | null;
  source_url: string | null;
  /** Plain-text projection (search, notifications, CLI). */
  text: string;
  /** Composed MessageBlock[] (src/blocks.ts) — jsonb. */
  blocks: string | null;
  /** Parent message id — single-level replies, clamped to roots. */
  reply_to_id: string | null;
  /** Set on collaborator replies: {taskId, runId, sessionId, outcome} — drives "View code session" / stop UI. */
  collab: string | null;
  /** Hidden by a rollback (kept, not deleted). */
  rolled_back_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface ReactionRow {
  id: string;
  workspace_id: string;
  message_id: string;
  /** "user:<id>" or "bot:<id>". */
  actor_id: string;
  emoji: string;
  created_at: string;
}

export interface PinRow {
  id: string;
  workspace_id: string;
  channel_id: string;
  message_id: string;
  pinned_by: string;
  created_at: string;
}

export interface SavedRow {
  id: string;
  workspace_id: string;
  message_id: string;
  user_id: string;
  created_at: string;
}

export interface DraftRow {
  id: string;
  workspace_id: string;
  channel_id: string;
  user_id: string;
  text: string;
  updated_at: string;
}

export interface ReadStateRow {
  id: string;
  workspace_id: string;
  channel_id: string;
  user_id: string;
  last_read_message_id: string | null;
  updated_at: string;
}

export interface AssetRow {
  id: string;
  workspace_id: string;
  channel_id: string | null;
  uploader_actor_id: string;
  filename: string;
  content_type: string | null;
  size: number;
  /** Storage key — TwoDrive S3 (stub for now) or local dir. */
  storage_key: string;
  created_at: string;
}

export interface BotRow {
  id: string;
  workspace_id: string;
  name: string;
  /** Free-form descriptor: "sentinel", "twodb-runner", "my-cron-bot"… */
  kind: string;
  /** Gateway workspace API key id that authorizes this bot to post. */
  api_key_id: string | null;
  avatar_emoji: string | null;
  description: string | null;
  /** Set for bots backed by another app (e.g. "artisan" + the agent id): messages to them start runs there. */
  runtime_app: string | null;
  runtime_ref: string | null;
  /** A runtime bot that can currently run (collaborator has a runner + directory). */
  enabled: boolean;
  created_at: string;
}

/**
 * Durable interaction created when a human clicks a bot message button.
 * Agents fetch their action inbox through GET /bots/actions and acknowledge
 * items after processing. This keeps interactive blocks useful even when the
 * bot was offline at click time.
 */
export interface MessageActionRow {
  id: string;
  workspace_id: string;
  message_id: string;
  channel_id: string;
  bot_id: string;
  action_id: string;
  value: string | null;
  user_id: string;
  acknowledged_at: string | null;
  created_at: string;
}

/** Dynamic top-level tab. `space_id=null` means workspace-wide. */
export interface ConversationListRow {
  id: string;
  workspace_id: string;
  space_id: string | null;
  name: string;
  position: number;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TwoChatDb {
  channel: ChannelRow;
  channel_member: ChannelMemberRow;
  message: MessageRow;
  reaction: ReactionRow;
  pin: PinRow;
  saved: SavedRow;
  draft: DraftRow;
  read_state: ReadStateRow;
  asset: AssetRow;
  bot: BotRow;
  message_action: MessageActionRow;
  conversation_list: ConversationListRow;
  collab_task: CollabTaskRow;
  collab_run: CollabRunRow;
}

const now = sql`now()`;

export async function applySchema(db: Kysely<TwoChatDb>): Promise<void> {
  await db.schema
    .createTable("channel")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("list_id", "text")
    .addColumn("kind", "text", (c) => c.notNull().defaultTo("channel"))
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("topic", "text")
    .addColumn("is_read_only", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("source_provider", "text")
    .addColumn("source_external_id", "text")
    .addColumn("source_url", "text")
    .addColumn("avatar_url", "text")
    .addColumn("dm_key", "text")
    .addColumn("created_by", "text")
    .addColumn("created_by_type", "text", (c) => c.notNull().defaultTo("user"))
    .addColumn("position", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("last_message_at", "timestamptz")
    .addColumn("archived_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema.createIndex("channel_workspace_idx").ifNotExists().on("channel").columns(["workspace_id"]).execute();
  await db.schema.createIndex("channel_dm_key_idx").ifNotExists().on("channel").columns(["workspace_id", "dm_key"]).execute();
  await db.schema
    .createIndex("channel_ws_kind_name_idx")
    .ifNotExists()
    .on("channel")
    .columns(["workspace_id", "kind", "name"])
    .execute();

  await db.schema
    .createTable("channel_member")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("channel_id", "text", (c) => c.notNull())
    .addColumn("member_type", "text", (c) => c.notNull())
    .addColumn("user_id", "text")
    .addColumn("bot_id", "text")
    .addColumn("role", "text", (c) => c.notNull().defaultTo("member"))
    .addColumn("joined_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema.createIndex("channel_member_channel_idx").ifNotExists().on("channel_member").columns(["channel_id"]).execute();
  await db.schema
    .createIndex("channel_member_user_idx")
    .ifNotExists()
    .on("channel_member")
    .columns(["user_id", "channel_id"])
    .execute();
  await db.schema.createIndex("channel_member_bot_idx").ifNotExists().on("channel_member").columns(["bot_id", "channel_id"]).execute();

  await db.schema
    .createTable("message")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("channel_id", "text", (c) => c.notNull())
    .addColumn("author_type", "text", (c) => c.notNull())
    .addColumn("user_id", "text")
    .addColumn("bot_id", "text")
    .addColumn("author_name", "text")
    .addColumn("author_avatar_url", "text")
    .addColumn("external_id", "text")
    .addColumn("source_url", "text")
    .addColumn("text", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("blocks", "jsonb")
    .addColumn("reply_to_id", "text")
    .addColumn("edited_at", "timestamptz")
    .addColumn("deleted_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema.createIndex("message_channel_created_idx").ifNotExists().on("message").columns(["channel_id", "created_at"]).execute();
  await db.schema.createIndex("message_reply_idx").ifNotExists().on("message").columns(["reply_to_id"]).execute();
  await db.schema.createIndex("message_workspace_created_idx").ifNotExists().on("message").columns(["workspace_id", "created_at"]).execute();

  await db.schema
    .createTable("reaction")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("message_id", "text", (c) => c.notNull())
    .addColumn("actor_id", "text", (c) => c.notNull())
    .addColumn("emoji", "text", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema
    .createIndex("reaction_message_idx")
    .ifNotExists()
    .on("reaction")
    .columns(["message_id", "actor_id", "emoji"])
    .execute();

  await db.schema
    .createTable("pin")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("channel_id", "text", (c) => c.notNull())
    .addColumn("message_id", "text", (c) => c.notNull())
    .addColumn("pinned_by", "text", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema.createIndex("pin_channel_idx").ifNotExists().on("pin").columns(["channel_id"]).execute();
  await db.schema.createIndex("pin_message_idx").ifNotExists().on("pin").columns(["message_id"]).execute();

  await db.schema
    .createTable("saved")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.notNull().primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("message_id", "text", (c) => c.notNull())
    .addColumn("user_id", "text", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema.createIndex("saved_user_idx").ifNotExists().on("saved").columns(["user_id"]).execute();
  await db.schema
    .createIndex("saved_message_user_idx")
    .ifNotExists()
    .on("saved")
    .columns(["message_id", "user_id"])
    .execute();

  await db.schema
    .createTable("draft")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("channel_id", "text", (c) => c.notNull())
    .addColumn("user_id", "text", (c) => c.notNull())
    .addColumn("text", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema
    .createIndex("draft_channel_user_idx")
    .ifNotExists()
    .on("draft")
    .columns(["channel_id", "user_id"])
    .execute();

  await db.schema
    .createTable("read_state")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("channel_id", "text", (c) => c.notNull())
    .addColumn("user_id", "text", (c) => c.notNull())
    .addColumn("last_read_message_id", "text")
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema
    .createIndex("read_state_channel_user_idx")
    .ifNotExists()
    .on("read_state")
    .columns(["channel_id", "user_id"])
    .execute();

  await db.schema
    .createTable("asset")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("channel_id", "text")
    .addColumn("uploader_actor_id", "text", (c) => c.notNull())
    .addColumn("filename", "text", (c) => c.notNull())
    .addColumn("content_type", "text")
    .addColumn("size", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("storage_key", "text", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema.createIndex("asset_channel_idx").ifNotExists().on("asset").columns(["channel_id"]).execute();

  await db.schema
    .createTable("bot")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("kind", "text", (c) => c.notNull().defaultTo("generic"))
    .addColumn("api_key_id", "text")
    .addColumn("avatar_emoji", "text")
    .addColumn("description", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema.createIndex("bot_workspace_idx").ifNotExists().on("bot").columns(["workspace_id"]).execute();
  await db.schema.createIndex("bot_api_key_idx").ifNotExists().on("bot").columns(["workspace_id", "api_key_id"]).execute();

  // Notifications moved to the control plane (TwoDB) — see core/core-notify. The
  // legacy `notification` table is left in place on existing databases (harmless).

  await db.schema
    .createTable("message_action")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("message_id", "text", (c) => c.notNull())
    .addColumn("channel_id", "text", (c) => c.notNull())
    .addColumn("bot_id", "text", (c) => c.notNull())
    .addColumn("action_id", "text", (c) => c.notNull())
    .addColumn("value", "text")
    .addColumn("user_id", "text", (c) => c.notNull())
    .addColumn("acknowledged_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema
    .createIndex("message_action_bot_created_idx")
    .ifNotExists()
    .on("message_action")
    .columns(["bot_id", "created_at"])
    .execute();
  await db.schema
    .createIndex("message_action_message_idx")
    .ifNotExists()
    .on("message_action")
    .columns(["message_id"])
    .execute();

  await db.schema
    .createTable("conversation_list")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("space_id", "text")
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("position", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("is_default", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("created_by", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(now))
    .execute();
  await db.schema.createIndex("conversation_list_workspace_idx").ifNotExists().on("conversation_list").columns(["workspace_id", "position"]).execute();
  await db.schema.createIndex("conversation_list_space_idx").ifNotExists().on("conversation_list").columns(["space_id"]).execute();

  // Existing installations predate list/source columns. Keep bootstrap
  // idempotent without requiring a separate migration runner.
  await sql`alter table channel add column if not exists list_id text`.execute(db);
  await sql`alter table channel add column if not exists is_read_only boolean not null default false`.execute(db);
  await sql`alter table channel add column if not exists source_provider text`.execute(db);
  await sql`alter table channel add column if not exists source_external_id text`.execute(db);
  await sql`alter table channel add column if not exists source_url text`.execute(db);
  await sql`alter table channel add column if not exists avatar_url text`.execute(db);
  await sql`alter table message add column if not exists author_name text`.execute(db);
  await sql`alter table message add column if not exists author_avatar_url text`.execute(db);
  await sql`alter table message add column if not exists external_id text`.execute(db);
  await sql`alter table message add column if not exists source_url text`.execute(db);
  await sql`create index if not exists channel_list_idx on channel (list_id, position)`.execute(db);
  await sql`create unique index if not exists message_channel_external_idx on message (channel_id, external_id) where external_id is not null`.execute(db);
  await applyCollabSchema(db as never);


}
