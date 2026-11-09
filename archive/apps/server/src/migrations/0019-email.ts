import { sql } from "kysely";
import type { Migration } from "kysely/migration";
import { db } from "../auth";

/**
 * Email: connected accounts (gmail api / imap+smtp) owned per user and
 * optionally shared through members. Mail is stored locally — threads,
 * messages (inbound + our outbox), attachments (bytes in the
 * email_attachments storage destination). Labels are local, nested
 * (materialized id path) and many-to-many with threads. Sender rules route
 * future mail to spam. media_asset gains a sha256 for attachment dedupe.
 */
export const up: Migration["up"] = async () => {
  const foreignKey = (table: string, name: string, columns: string[], refTable: string, onDelete?: "cascade" | "set null") =>
    db.schema
      .alterTable(table)
      .addForeignKeyConstraint(name, columns, refTable, ["id"], (c) => (onDelete ? c.onDelete(onDelete) : c))
      .execute();
  const index = (name: string, table: string, columns: string[]) => db.schema.createIndex(name).on(table).columns(columns).execute();
  const jsonb = sql`jsonb`;
  const emptyArray = sql`'[]'::jsonb`;
  const emptyObject = sql`'{}'::jsonb`;

  await db.schema.alterTable("media_asset").addColumn("sha256", "text").execute();
  await index("media_asset_sha256_idx", "media_asset", ["organizationId", "sha256"]);

  await db.schema
    .createTable("email_account")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("ownerUserId", "text", (c) => c.notNull())
    .addColumn("visibility", "text", (c) => c.defaultTo("private").notNull())
    .addColumn("kind", "text", (c) => c.notNull())
    .addColumn("preset", "text")
    .addColumn("address", "text", (c) => c.notNull())
    .addColumn("displayName", "text")
    .addColumn("aliases", jsonb, (c) => c.defaultTo(emptyArray).notNull())
    .addColumn("config", jsonb, (c) => c.defaultTo(emptyObject).notNull())
    .addColumn("credentials", "text")
    .addColumn("syncCursor", jsonb, (c) => c.defaultTo(emptyObject).notNull())
    .addColumn("backfillCursor", jsonb)
    .addColumn("backfillState", "text", (c) => c.defaultTo("pending").notNull())
    .addColumn("backfillProgress", jsonb, (c) => c.defaultTo(emptyObject).notNull())
    .addColumn("status", "text", (c) => c.defaultTo("active").notNull())
    .addColumn("lastError", "text")
    .addColumn("lastSyncedAt", "timestamptz")
    .addColumn("nextSyncAt", "timestamptz")
    .addColumn("syncIntervalSec", "integer", (c) => c.defaultTo(120).notNull())
    .addColumn("signatureHtml", "text")
    .addColumn("color", "text")
    .addColumn("position", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addColumn("deletedAt", "timestamptz")
    .execute();
  await foreignKey("email_account", "email_account_org_fk", ["organizationId"], "organization", "cascade");
  await foreignKey("email_account", "email_account_owner_fk", ["ownerUserId"], "user", "cascade");
  await index("email_account_org_idx", "email_account", ["organizationId"]);
  await index("email_account_next_sync_idx", "email_account", ["nextSyncAt"]);

  await db.schema
    .createTable("email_account_member")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("accountId", "text", (c) => c.notNull())
    .addColumn("userId", "text", (c) => c.notNull())
    .addColumn("role", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addUniqueConstraint("email_account_member_unique", ["accountId", "userId"])
    .execute();
  await foreignKey("email_account_member", "email_account_member_account_fk", ["accountId"], "email_account", "cascade");
  await foreignKey("email_account_member", "email_account_member_user_fk", ["userId"], "user", "cascade");
  await index("email_account_member_user_idx", "email_account_member", ["userId"]);

  await db.schema
    .createTable("email_thread")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("accountId", "text", (c) => c.notNull())
    .addColumn("providerThreadId", "text")
    .addColumn("subject", "text", (c) => c.defaultTo("").notNull())
    .addColumn("location", "text", (c) => c.defaultTo("inbox").notNull())
    .addColumn("isPinned", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("snoozedUntil", "timestamptz")
    .addColumn("mutedAt", "timestamptz")
    .addColumn("lastMessageAt", "timestamptz", (c) => c.notNull())
    .addColumn("lastInboundAt", "timestamptz")
    .addColumn("messageCount", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("unreadCount", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("hasAttachments", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("hasStarred", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("hasDraft", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("hasSent", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("hasOutbox", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("hasScheduled", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("hasDeletedMessages", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("participants", jsonb, (c) => c.defaultTo(emptyArray).notNull())
    .addColumn("snippet", "text")
    .addColumn("deletedAt", "timestamptz")
    .addColumn("deletedByUserId", "text")
    .addColumn("purgedAt", "timestamptz")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();
  await foreignKey("email_thread", "email_thread_account_fk", ["accountId"], "email_account", "cascade");
  await index("email_thread_account_last_idx", "email_thread", ["accountId", "lastMessageAt"]);
  await index("email_thread_provider_idx", "email_thread", ["accountId", "providerThreadId"]);
  await sql`create index email_thread_location_idx on email_thread ("accountId", location, "lastMessageAt" desc) where "deletedAt" is null and "purgedAt" is null`.execute(db);
  await sql`create index email_thread_deleted_idx on email_thread ("accountId", "deletedAt") where "deletedAt" is not null`.execute(db);

  await db.schema
    .createTable("email_message")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("accountId", "text", (c) => c.notNull())
    .addColumn("threadId", "text", (c) => c.notNull())
    .addColumn("direction", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull())
    .addColumn("composeKind", "text")
    .addColumn("sourceMessageId", "text")
    .addColumn("providerMessageId", "text")
    .addColumn("providerThreadId", "text")
    .addColumn("rfcMessageId", "text")
    .addColumn("inReplyTo", "text")
    .addColumn("references", sql`text[]`, (c) => c.defaultTo(sql`'{}'::text[]`).notNull())
    .addColumn("fromAddress", "text")
    .addColumn("fromName", "text")
    .addColumn("to", jsonb, (c) => c.defaultTo(emptyArray).notNull())
    .addColumn("cc", jsonb, (c) => c.defaultTo(emptyArray).notNull())
    .addColumn("bcc", jsonb, (c) => c.defaultTo(emptyArray).notNull())
    .addColumn("replyTo", jsonb, (c) => c.defaultTo(emptyArray).notNull())
    .addColumn("subject", "text", (c) => c.defaultTo("").notNull())
    .addColumn("snippet", "text")
    .addColumn("bodyText", "text")
    .addColumn("bodyHtml", "text")
    .addColumn("headers", jsonb, (c) => c.defaultTo(emptyObject).notNull())
    .addColumn("rawMediaId", "text")
    .addColumn("sentAt", "timestamptz")
    .addColumn("receivedAt", "timestamptz")
    .addColumn("scheduledAt", "timestamptz")
    .addColumn("sendAfter", "timestamptz")
    .addColumn("attempts", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("nextAttemptAt", "timestamptz")
    .addColumn("lastError", "text")
    .addColumn("isRead", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("isStarred", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("sentByUserId", "text")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addColumn("deletedAt", "timestamptz")
    .addColumn("deletedByUserId", "text")
    .addColumn("purgedAt", "timestamptz")
    .execute();
  await sql`
    alter table email_message add column "searchVector" tsvector generated always as (
      to_tsvector('simple',
        coalesce(subject, '') || ' ' || coalesce("fromName", '') || ' ' || coalesce("fromAddress", '') || ' ' ||
        coalesce("to"::text, '') || ' ' || left(coalesce("bodyText", ''), 200000))
    ) stored`.execute(db);
  await foreignKey("email_message", "email_message_account_fk", ["accountId"], "email_account", "cascade");
  await foreignKey("email_message", "email_message_thread_fk", ["threadId"], "email_thread", "cascade");
  await foreignKey("email_message", "email_message_source_fk", ["sourceMessageId"], "email_message", "set null");
  await index("email_message_thread_idx", "email_message", ["threadId", "sentAt"]);
  await index("email_message_rfc_idx", "email_message", ["accountId", "rfcMessageId"]);
  await sql`create unique index email_message_provider_unique on email_message ("accountId", "providerMessageId") where "providerMessageId" is not null`.execute(db);
  await sql`create index email_message_outbox_idx on email_message (status, "nextAttemptAt") where status in ('queued', 'scheduled', 'sending')`.execute(db);
  await sql`create index email_message_search_idx on email_message using gin ("searchVector")`.execute(db);

  await db.schema
    .createTable("email_attachment")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("messageId", "text", (c) => c.notNull())
    .addColumn("mediaId", "text")
    .addColumn("filename", "text", (c) => c.notNull())
    .addColumn("contentType", "text")
    .addColumn("size", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("contentId", "text")
    .addColumn("isInline", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("status", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();
  await foreignKey("email_attachment", "email_attachment_message_fk", ["messageId"], "email_message", "cascade");
  await index("email_attachment_message_idx", "email_attachment", ["messageId"]);
  await index("email_attachment_media_idx", "email_attachment", ["mediaId"]);

  await db.schema
    .createTable("email_label")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("ownerUserId", "text", (c) => c.notNull())
    .addColumn("accountId", "text")
    .addColumn("parentId", "text")
    .addColumn("path", "text", (c) => c.notNull())
    .addColumn("depth", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("color", "text")
    .addColumn("position", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();
  await foreignKey("email_label", "email_label_account_fk", ["accountId"], "email_account", "cascade");
  await foreignKey("email_label", "email_label_parent_fk", ["parentId"], "email_label", "cascade");
  await foreignKey("email_label", "email_label_owner_fk", ["ownerUserId"], "user", "cascade");
  await index("email_label_owner_idx", "email_label", ["organizationId", "ownerUserId"]);
  await index("email_label_parent_idx", "email_label", ["parentId"]);
  await sql`create index email_label_path_idx on email_label (path text_pattern_ops)`.execute(db);

  await db.schema
    .createTable("email_thread_label")
    .addColumn("threadId", "text", (c) => c.notNull())
    .addColumn("labelId", "text", (c) => c.notNull())
    .addColumn("addedByUserId", "text")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addPrimaryKeyConstraint("email_thread_label_pk", ["threadId", "labelId"])
    .execute();
  await foreignKey("email_thread_label", "email_thread_label_thread_fk", ["threadId"], "email_thread", "cascade");
  await foreignKey("email_thread_label", "email_thread_label_label_fk", ["labelId"], "email_label", "cascade");
  await index("email_thread_label_label_idx", "email_thread_label", ["labelId", "threadId"]);

  await db.schema
    .createTable("email_sender_rule")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("ownerUserId", "text", (c) => c.notNull())
    .addColumn("accountId", "text")
    .addColumn("matchType", "text", (c) => c.notNull())
    .addColumn("value", "text", (c) => c.notNull())
    .addColumn("action", "text", (c) => c.defaultTo("spam").notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();
  await foreignKey("email_sender_rule", "email_sender_rule_account_fk", ["accountId"], "email_account", "cascade");
  await index("email_sender_rule_owner_idx", "email_sender_rule", ["organizationId", "ownerUserId"]);
};
