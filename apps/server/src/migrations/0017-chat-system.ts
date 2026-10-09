import type { Migration } from "kysely/migration";
import { db } from "../auth";

/**
 * Team chat system: channels (tree), members (users + agents), messages with
 * single-level replies, reactions, pins, saved items, drafts and read state.
 * Agents gain a display name; media_asset gains a chat channel binding;
 * code_session gains chatChannelId so per-(channel × agent) sessions can be
 * found and filtered out of the code sidenav.
 */
export const up: Migration["up"] = async () => {
  const foreignKey = (table: string, name: string, columns: string[], refTable: string, onDelete?: "cascade" | "set null") =>
    db.schema
      .alterTable(table)
      .addForeignKeyConstraint(name, columns, refTable, ["id"], (c) => (onDelete ? c.onDelete(onDelete) : c))
      .execute();
  const index = (name: string, table: string, columns: string[]) => db.schema.createIndex(name).on(table).columns(columns).execute();

  await db.schema
    .createTable("chat_channel")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("codeDirectoryId", "text")
    .addColumn("parentId", "text")
    .addColumn("kind", "text", (c) => c.defaultTo("channel").notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text")
    .addColumn("position", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("createdById", "text")
    .addColumn("lastMessageAt", "timestamptz")
    .addColumn("archivedAt", "timestamptz")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();
  await foreignKey("chat_channel", "chat_channel_parent_fk", ["parentId"], "chat_channel", "cascade");
  await index("chat_channel_org_idx", "chat_channel", ["organizationId"]);
  await index("chat_channel_parent_idx", "chat_channel", ["parentId"]);

  await db.schema
    .createTable("chat_channel_member")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("channelId", "text", (c) => c.notNull())
    .addColumn("memberType", "text", (c) => c.notNull())
    .addColumn("userId", "text")
    .addColumn("agentId", "text")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();
  await foreignKey("chat_channel_member", "chat_channel_member_channel_fk", ["channelId"], "chat_channel", "cascade");
  await foreignKey("chat_channel_member", "chat_channel_member_agent_fk", ["agentId"], "agent", "cascade");
  await index("chat_channel_member_channel_idx", "chat_channel_member", ["channelId"]);
  await index("chat_channel_member_agent_idx", "chat_channel_member", ["agentId"]);

  await db.schema
    .createTable("chat_message")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("channelId", "text", (c) => c.notNull())
    .addColumn("authorType", "text", (c) => c.notNull())
    .addColumn("userId", "text")
    .addColumn("agentId", "text")
    .addColumn("body", "text", (c) => c.notNull())
    .addColumn("meta", "jsonb")
    .addColumn("replyToId", "text")
    .addColumn("editedAt", "timestamptz")
    .addColumn("deletedAt", "timestamptz")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();
  await foreignKey("chat_message", "chat_message_channel_fk", ["channelId"], "chat_channel", "cascade");
  await foreignKey("chat_message", "chat_message_agent_fk", ["agentId"], "agent", "set null");
  await foreignKey("chat_message", "chat_message_reply_fk", ["replyToId"], "chat_message", "set null");
  await index("chat_message_channel_created_idx", "chat_message", ["channelId", "createdAt"]);
  await index("chat_message_reply_idx", "chat_message", ["replyToId"]);

  await db.schema
    .createTable("chat_reaction")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("messageId", "text", (c) => c.notNull())
    .addColumn("authorType", "text", (c) => c.notNull())
    .addColumn("userId", "text")
    .addColumn("emoji", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();
  await foreignKey("chat_reaction", "chat_reaction_message_fk", ["messageId"], "chat_message", "cascade");
  await index("chat_reaction_message_idx", "chat_reaction", ["messageId"]);

  await db.schema
    .createTable("chat_pin")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("channelId", "text", (c) => c.notNull())
    .addColumn("messageId", "text", (c) => c.notNull())
    .addColumn("createdById", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();
  await foreignKey("chat_pin", "chat_pin_channel_fk", ["channelId"], "chat_channel", "cascade");
  await foreignKey("chat_pin", "chat_pin_message_fk", ["messageId"], "chat_message", "cascade");
  await index("chat_pin_channel_idx", "chat_pin", ["channelId"]);

  await db.schema
    .createTable("chat_saved")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("messageId", "text", (c) => c.notNull())
    .addColumn("userId", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();
  await foreignKey("chat_saved", "chat_saved_message_fk", ["messageId"], "chat_message", "cascade");
  await index("chat_saved_user_idx", "chat_saved", ["userId"]);
  await db.schema.alterTable("chat_saved").addUniqueConstraint("chat_saved_message_user_uniq", ["messageId", "userId"]).execute();

  await db.schema
    .createTable("chat_draft")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("channelId", "text", (c) => c.notNull())
    .addColumn("userId", "text", (c) => c.notNull())
    .addColumn("body", "text", (c) => c.defaultTo("").notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();
  await foreignKey("chat_draft", "chat_draft_channel_fk", ["channelId"], "chat_channel", "cascade");
  await index("chat_draft_channel_user_idx", "chat_draft", ["channelId", "userId"]);
  await db.schema.alterTable("chat_draft").addUniqueConstraint("chat_draft_channel_user_uniq", ["channelId", "userId"]).execute();

  await db.schema
    .createTable("chat_read_state")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("channelId", "text", (c) => c.notNull())
    .addColumn("userId", "text", (c) => c.notNull())
    .addColumn("lastReadMessageId", "text")
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();
  await foreignKey("chat_read_state", "chat_read_state_channel_fk", ["channelId"], "chat_channel", "cascade");
  await index("chat_read_state_channel_user_idx", "chat_read_state", ["channelId", "userId"]);
  await db.schema.alterTable("chat_read_state").addUniqueConstraint("chat_read_state_channel_user_uniq", ["channelId", "userId"]).execute();

  await db.schema.alterTable("agent").addColumn("name", "text").execute();

  await db.schema.alterTable("media_asset").addColumn("chatChannelId", "text").execute();
  await foreignKey("media_asset", "media_asset_chat_channel_fk", ["chatChannelId"], "chat_channel", "cascade");
  await index("media_asset_chat_channel_idx", "media_asset", ["chatChannelId"]);

  await db.schema.alterTable("code_session").addColumn("chatChannelId", "text").execute();
  await foreignKey("code_session", "code_session_chat_channel_fk", ["chatChannelId"], "chat_channel", "cascade");
  await index("code_session_chat_channel_idx", "code_session", ["chatChannelId"]);
};
