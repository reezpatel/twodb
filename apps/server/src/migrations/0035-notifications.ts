import { sql } from "kysely";
import type { Migration } from "kysely/migration";
import { db } from "../auth";

/** Notifications v2: source-aware envelope (origin/group/type, urgency,
 *  expiry, actions, deep link, grouping, dedupe) + per-recipient lifecycle
 *  rows (seen/read/dismissed=archived) + group/type channel preferences.
 *  Old rows are calendar reminders — backfilled as origin=calendar. */

const EXPIRY_DAYS = 30;

export const up: Migration["up"] = async () => {
  await db.schema
    .createTable("notification_recipient")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("notificationId", "text", (c) => c.notNull())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("userId", "text", (c) => c.notNull())
    .addColumn("seenAt", "timestamptz")
    .addColumn("readAt", "timestamptz")
    .addColumn("dismissedAt", "timestamptz")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addUniqueConstraint("notification_recipient_unique", ["notificationId", "userId"])
    .execute();
  await db.schema
    .createIndex("notification_recipient_user_idx")
    .on("notification_recipient")
    .columns(["organizationId", "userId", "createdAt"])
    .execute();
  await db.schema
    .alterTable("notification_recipient")
    .addForeignKeyConstraint("notification_recipient_notificationId_fkey", ["notificationId"], "notification", ["id"], (c) => c.onDelete("cascade"))
    .execute();
  await db.schema
    .alterTable("notification_recipient")
    .addForeignKeyConstraint("notification_recipient_userId_fkey", ["userId"], "user", ["id"], (c) => c.onDelete("cascade"))
    .execute();

  await db.schema
    .createTable("notification_preference")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("userId", "text", (c) => c.notNull())
    .addColumn("groupId", "text", (c) => c.notNull())
    .addColumn("typeId", "text")
    .addColumn("channels", sql`jsonb`, (c) => c.notNull())
    .addColumn("urgencyFloor", "text")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addUniqueConstraint("notification_preference_unique", ["organizationId", "userId", "groupId", "typeId"])
    .execute();
  await db.schema
    .createIndex("notification_preference_user_idx")
    .on("notification_preference")
    .columns(["organizationId", "userId"])
    .execute();
  await db.schema
    .alterTable("notification_preference")
    .addForeignKeyConstraint("notification_preference_userId_fkey", ["userId"], "user", ["id"], (c) => c.onDelete("cascade"))
    .execute();

  await db.schema
    .alterTable("notification")
    .addColumn("origin", "text", (c) => c.notNull().defaultTo("core"))
    .addColumn("type", "text", (c) => c.notNull().defaultTo("core.system"))
    .addColumn("urgency", "text", (c) => c.notNull().defaultTo("normal"))
    .addColumn("icon", "text")
    .addColumn("accent", "text")
    .addColumn("audience", "text")
    .addColumn("actorName", "text")
    .addColumn("actorImage", "text")
    .addColumn("media", sql`jsonb`)
    .addColumn("actions", sql`jsonb`)
    .addColumn("deepLink", "text")
    .addColumn("groupingKey", "text")
    .addColumn("dedupeKey", "text")
    .addColumn("silent", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("revision", "integer", (c) => c.defaultTo(1).notNull())
    .addColumn("updatedAt", "timestamptz")
    .addColumn("expiresAt", "timestamptz")
    .execute();
  await db.schema.createIndex("notification_org_created_idx").on("notification").columns(["organizationId", "createdAt"]).execute();
  await db.schema.createIndex("notification_dedupe_idx").on("notification").columns(["organizationId", "dedupeKey"]).execute();
  // Backfill: existing rows are calendar reminders; readAt moves to recipient rows.
  await sql`
    update "notification"
       set "origin" = 'calendar', "type" = 'calendar.reminder', "urgency" = 'high',
           "revision" = 1, "updatedAt" = "createdAt",
           "expiresAt" = "createdAt" + interval '${sql.raw(String(EXPIRY_DAYS))} days'
  `.execute(db);
  await sql`
    insert into "notification_recipient" ("id", "notificationId", "organizationId", "userId", "seenAt", "readAt", "dismissedAt", "createdAt")
    select gen_random_uuid()::text, "id", "organizationId", "userId", "readAt", "readAt", null, "createdAt"
      from "notification"
     on conflict do nothing
  `.execute(db);
};
