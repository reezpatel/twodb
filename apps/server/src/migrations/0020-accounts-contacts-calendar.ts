import { sql } from "kysely";
import type { Migration } from "kysely/migration";
import { db } from "../auth";

/**
 * Combined accounts + contacts + calendar.
 *
 * email_account becomes connected_account (one login → mail and/or calendar
 * capabilities); kinds become google | microsoft | imap. Contacts are learned
 * locally into one book per account plus one local book per user. Calendar
 * stores calendars, events (recurrence masters + overrides), a materialized
 * occurrence table, and calendar_change — the Pending push queue that only
 * reaches a provider after a user approves it.
 */
export const up: Migration["up"] = async () => {
  const foreignKey = (table: string, name: string, columns: string[], refTable: string, onDelete?: "cascade" | "set null") =>
    db.schema
      .alterTable(table)
      .addForeignKeyConstraint(name, columns, refTable, ["id"], (c) => (onDelete ? c.onDelete(onDelete) : c))
      .execute();
  const index = (name: string, table: string, columns: string[]) => db.schema.createIndex(name).on(table).columns(columns).execute();
  const jsonb = sql`jsonb`;
  const textArray = sql`text[]`;
  const emptyArray = sql`'[]'::jsonb`;
  const emptyObject = sql`'{}'::jsonb`;
  const emptyTextArray = sql`'{}'::text[]`;

  // ── combined account ─────────────────────────────────────────────────────
  await db.schema.alterTable("email_account").renameTo("connected_account").execute();
  await db.schema.alterTable("email_account_member").renameTo("connected_account_member").execute();
  await sql`update connected_account set kind = 'google', preset = 'google' where kind = 'gmail'`.execute(db);
  await sql`update connected_account set kind = 'imap' where kind = 'imap_smtp'`.execute(db);
  await db.schema
    .alterTable("connected_account")
    .addColumn("capabilities", textArray, (c) => c.defaultTo(sql`'{mail}'::text[]`).notNull())
    .addColumn("grantedScopes", textArray, (c) => c.defaultTo(emptyTextArray).notNull())
    .addColumn("calendarState", "text", (c) => c.defaultTo("disabled").notNull())
    .addColumn("calendarError", "text")
    .addColumn("calendarImportState", "text", (c) => c.defaultTo("pending").notNull())
    .addColumn("calendarImportProgress", jsonb, (c) => c.defaultTo(emptyObject).notNull())
    .addColumn("calendarImportFrom", "date")
    .addColumn("calendarListSyncedAt", "timestamptz")
    .addColumn("calendarLastSyncedAt", "timestamptz")
    .addColumn("calendarNextSyncAt", "timestamptz")
    .addColumn("syncMode", "text", (c) => c.defaultTo("polling").notNull())
    .addColumn("suggestOrgMembers", "boolean", (c) => c.defaultTo(false).notNull())
    .execute();
  await index("connected_account_calendar_sync_idx", "connected_account", ["calendarNextSyncAt"]);

  await db.schema
    .createTable("connected_account_webhook")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("accountId", "text", (c) => c.notNull())
    .addColumn("calendarId", "text")
    .addColumn("provider", "text", (c) => c.notNull())
    .addColumn("channelId", "text", (c) => c.notNull())
    .addColumn("resourceId", "text")
    .addColumn("secretHash", "text", (c) => c.notNull())
    .addColumn("expiresAt", "timestamptz", (c) => c.notNull())
    .addColumn("lastNotifiedAt", "timestamptz")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();
  await foreignKey("connected_account_webhook", "connected_account_webhook_account_fk", ["accountId"], "connected_account", "cascade");
  await sql`create unique index connected_account_webhook_channel_idx on connected_account_webhook ("channelId")`.execute(db);
  await index("connected_account_webhook_expiry_idx", "connected_account_webhook", ["expiresAt"]);

  // ── contacts ─────────────────────────────────────────────────────────────
  await db.schema
    .createTable("contact_book")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("kind", "text", (c) => c.notNull())
    .addColumn("accountId", "text")
    .addColumn("ownerUserId", "text", (c) => c.notNull())
    .addColumn("learnState", "text", (c) => c.defaultTo("pending").notNull())
    .addColumn("learnProgress", jsonb, (c) => c.defaultTo(emptyObject).notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addColumn("deletedAt", "timestamptz")
    .execute();
  await foreignKey("contact_book", "contact_book_account_fk", ["accountId"], "connected_account", "cascade");
  await foreignKey("contact_book", "contact_book_owner_fk", ["ownerUserId"], "user", "cascade");
  await sql`create unique index contact_book_account_idx on contact_book ("accountId") where "accountId" is not null`.execute(db);
  await sql`create unique index contact_book_local_idx on contact_book ("organizationId", "ownerUserId") where kind = 'local'`.execute(db);

  await db.schema
    .createTable("contact")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("bookId", "text", (c) => c.notNull())
    .addColumn("email", "text", (c) => c.notNull())
    .addColumn("name", "text")
    .addColumn("nameSource", "text", (c) => c.defaultTo("email").notNull())
    .addColumn("kind", "text", (c) => c.defaultTo("person").notNull())
    .addColumn("domain", "text", (c) => c.generatedAlwaysAs(sql`split_part(email, '@', 2)`).stored())
    .addColumn("notes", "text")
    .addColumn("userId", "text")
    .addColumn("sentCount", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("receivedCount", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("repliedCount", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("meetingCount", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("organizedByMeCount", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("organizedByThemCount", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("score", "real", (c) => c.defaultTo(0).notNull())
    .addColumn("firstSeenAt", "timestamptz", (c) => c.notNull())
    .addColumn("lastSeenAt", "timestamptz", (c) => c.notNull())
    .addColumn("lastEmailAt", "timestamptz")
    .addColumn("lastMeetingAt", "timestamptz")
    .addColumn("nextMeetingAt", "timestamptz")
    .addColumn("pinned", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("hidden", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("forgottenAt", "timestamptz")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addColumn("deletedAt", "timestamptz")
    .addUniqueConstraint("contact_book_email_unique", ["bookId", "email"])
    .execute();
  await foreignKey("contact", "contact_book_fk", ["bookId"], "contact_book", "cascade");
  await sql`create index contact_rank_idx on contact ("bookId", score desc) where hidden = false and "forgottenAt" is null and "deletedAt" is null`.execute(db);
  await sql`create index contact_email_prefix_idx on contact ("bookId", email text_pattern_ops)`.execute(db);
  await sql`create index contact_name_prefix_idx on contact ("bookId", lower(name) text_pattern_ops)`.execute(db);
  await index("contact_domain_idx", "contact", ["bookId", "domain"]);

  // ── calendars ────────────────────────────────────────────────────────────
  await db.schema
    .createTable("calendar")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("accountId", "text")
    .addColumn("ownerUserId", "text", (c) => c.notNull())
    .addColumn("providerCalendarId", "text")
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text")
    .addColumn("color", "text", (c) => c.defaultTo("#4f7cff").notNull())
    .addColumn("timezone", "text", (c) => c.defaultTo("UTC").notNull())
    .addColumn("kind", "text", (c) => c.defaultTo("regular").notNull())
    .addColumn("subscriptionUrl", "text")
    .addColumn("accessRole", "text", (c) => c.defaultTo("owner").notNull())
    .addColumn("isPrimary", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("defaultReminders", jsonb, (c) => c.defaultTo(emptyArray).notNull())
    .addColumn("allowedConference", textArray, (c) => c.defaultTo(emptyTextArray).notNull())
    .addColumn("syncCursor", "text")
    .addColumn("ctag", "text")
    .addColumn("syncEnabled", "boolean", (c) => c.defaultTo(true).notNull())
    .addColumn("lastSyncedAt", "timestamptz")
    .addColumn("lastError", "text")
    .addColumn("feedTokenHash", "text")
    .addColumn("occurrenceFrom", "date")
    .addColumn("occurrenceTo", "date")
    .addColumn("providerData", jsonb, (c) => c.defaultTo(emptyObject).notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addColumn("deletedAt", "timestamptz")
    .execute();
  await foreignKey("calendar", "calendar_account_fk", ["accountId"], "connected_account", "cascade");
  await foreignKey("calendar", "calendar_owner_fk", ["ownerUserId"], "user", "cascade");
  await foreignKey("calendar", "calendar_org_fk", ["organizationId"], "organization", "cascade");
  await sql`create unique index calendar_provider_idx on calendar ("accountId", "providerCalendarId") where "providerCalendarId" is not null`.execute(db);
  await index("calendar_owner_idx", "calendar", ["organizationId", "ownerUserId"]);
  await sql`create unique index calendar_feed_idx on calendar ("feedTokenHash") where "feedTokenHash" is not null`.execute(db);

  await db.schema
    .createTable("calendar_share")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("calendarId", "text", (c) => c.notNull())
    .addColumn("principalType", "text", (c) => c.notNull())
    .addColumn("principal", "text", (c) => c.notNull())
    .addColumn("role", "text", (c) => c.notNull())
    .addColumn("providerRuleId", "text")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addUniqueConstraint("calendar_share_unique", ["calendarId", "principalType", "principal"])
    .execute();
  await foreignKey("calendar_share", "calendar_share_calendar_fk", ["calendarId"], "calendar", "cascade");
  await index("calendar_share_principal_idx", "calendar_share", ["principalType", "principal"]);

  await db.schema
    .createTable("calendar_user_pref")
    .addColumn("userId", "text", (c) => c.notNull())
    .addColumn("calendarId", "text", (c) => c.notNull())
    .addColumn("hidden", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("color", "text")
    .addColumn("name", "text")
    .addColumn("sortOrder", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("notify", jsonb, (c) => c.defaultTo(emptyObject).notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addPrimaryKeyConstraint("calendar_user_pref_pk", ["userId", "calendarId"])
    .execute();
  await foreignKey("calendar_user_pref", "calendar_user_pref_calendar_fk", ["calendarId"], "calendar", "cascade");
  await foreignKey("calendar_user_pref", "calendar_user_pref_user_fk", ["userId"], "user", "cascade");

  // ── events ───────────────────────────────────────────────────────────────
  await db.schema
    .createTable("calendar_event")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("calendarId", "text", (c) => c.notNull())
    .addColumn("uid", "text", (c) => c.notNull())
    .addColumn("providerEventId", "text")
    .addColumn("etag", "text")
    .addColumn("sequence", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("recurringEventId", "text")
    .addColumn("originalStartAt", "timestamptz")
    .addColumn("originalStartDate", "date")
    .addColumn("rrule", textArray)
    .addColumn("status", "text", (c) => c.defaultTo("confirmed").notNull())
    .addColumn("title", "text", (c) => c.defaultTo("").notNull())
    .addColumn("descriptionHtml", "text")
    .addColumn("location", "text")
    .addColumn("geo", jsonb)
    .addColumn("isAllDay", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("startAt", "timestamptz")
    .addColumn("endAt", "timestamptz")
    .addColumn("startDate", "date")
    .addColumn("endDate", "date")
    .addColumn("startTz", "text")
    .addColumn("endTz", "text")
    .addColumn("isFloating", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("transparency", "text", (c) => c.defaultTo("opaque").notNull())
    .addColumn("visibility", "text", (c) => c.defaultTo("default").notNull())
    .addColumn("eventType", "text", (c) => c.defaultTo("default").notNull())
    .addColumn("eventTypeProps", jsonb, (c) => c.defaultTo(emptyObject).notNull())
    .addColumn("color", "text")
    .addColumn("organizer", jsonb)
    .addColumn("conference", jsonb)
    .addColumn("guestsCanModify", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("guestsCanInviteOthers", "boolean", (c) => c.defaultTo(true).notNull())
    .addColumn("guestsCanSeeOthers", "boolean", (c) => c.defaultTo(true).notNull())
    .addColumn("attendeesOmitted", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("attendeeText", "text", (c) => c.defaultTo("").notNull())
    .addColumn("meetingRecordingId", "text")
    .addColumn("source", "text", (c) => c.defaultTo("local").notNull())
    .addColumn("rawIcs", "text")
    .addColumn("providerData", jsonb, (c) => c.defaultTo(emptyObject).notNull())
    .addColumn("providerUpdatedAt", "timestamptz")
    .addColumn("pushState", "text", (c) => c.defaultTo("none").notNull())
    .addColumn("localOnly", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("localOnlyFields", jsonb, (c) => c.defaultTo(emptyObject).notNull())
    .addColumn("localDeletedAt", "timestamptz")
    .addColumn("createdByUserId", "text")
    .addColumn("searchVector", sql`tsvector`, (c) =>
      c
        .generatedAlwaysAs(
          sql`setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('simple', coalesce(location, '') || ' ' || coalesce("attendeeText", '')), 'B') || setweight(to_tsvector('simple', left(regexp_replace(coalesce("descriptionHtml", ''), '<[^>]+>', ' ', 'g'), 20000)), 'C')`,
        )
        .stored(),
    )
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addColumn("deletedAt", "timestamptz")
    .addColumn("deletedSource", "text")
    .execute();
  await foreignKey("calendar_event", "calendar_event_calendar_fk", ["calendarId"], "calendar", "cascade");
  await foreignKey("calendar_event", "calendar_event_master_fk", ["recurringEventId"], "calendar_event", "cascade");
  await sql`create unique index calendar_event_provider_idx on calendar_event ("calendarId", "providerEventId") where "providerEventId" is not null`.execute(
    db,
  );
  await index("calendar_event_uid_idx", "calendar_event", ["calendarId", "uid", "originalStartAt"]);
  await index("calendar_event_start_idx", "calendar_event", ["calendarId", "startAt"]);
  await index("calendar_event_master_idx", "calendar_event", ["recurringEventId"]);
  await sql`create index calendar_event_search_idx on calendar_event using gin ("searchVector")`.execute(db);
  await sql`create index calendar_event_deleted_idx on calendar_event ("calendarId", "deletedAt") where "deletedAt" is not null`.execute(db);

  await db.schema
    .createTable("calendar_event_attendee")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("eventId", "text", (c) => c.notNull())
    .addColumn("email", "text", (c) => c.notNull())
    .addColumn("name", "text")
    .addColumn("contactId", "text")
    .addColumn("userId", "text")
    .addColumn("role", "text", (c) => c.defaultTo("required").notNull())
    .addColumn("status", "text", (c) => c.defaultTo("needs_action").notNull())
    .addColumn("localStatus", "text")
    .addColumn("comment", "text")
    .addColumn("additionalGuests", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("isOrganizer", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("isSelf", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("respondedAt", "timestamptz")
    .addColumn("proposedStart", "timestamptz")
    .addColumn("proposedEnd", "timestamptz")
    .addUniqueConstraint("calendar_event_attendee_unique", ["eventId", "email"])
    .execute();
  await foreignKey("calendar_event_attendee", "calendar_event_attendee_event_fk", ["eventId"], "calendar_event", "cascade");
  await foreignKey("calendar_event_attendee", "calendar_event_attendee_contact_fk", ["contactId"], "contact", "set null");
  await index("calendar_event_attendee_email_idx", "calendar_event_attendee", ["email"]);
  await index("calendar_event_attendee_user_idx", "calendar_event_attendee", ["userId"]);

  await db.schema
    .createTable("calendar_event_reminder")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("eventId", "text", (c) => c.notNull())
    .addColumn("userId", "text")
    .addColumn("method", "text", (c) => c.defaultTo("popup").notNull())
    .addColumn("minutesBefore", "integer", (c) => c.notNull())
    .addColumn("localOnly", "boolean", (c) => c.defaultTo(false).notNull())
    .execute();
  await foreignKey("calendar_event_reminder", "calendar_event_reminder_event_fk", ["eventId"], "calendar_event", "cascade");
  await index("calendar_event_reminder_event_idx", "calendar_event_reminder", ["eventId"]);

  await db.schema
    .createTable("calendar_event_attachment")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("eventId", "text", (c) => c.notNull())
    .addColumn("mediaAssetId", "text")
    .addColumn("url", "text")
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("mimeType", "text")
    .addColumn("size", "integer")
    .addColumn("providerFileId", "text")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();
  await foreignKey("calendar_event_attachment", "calendar_event_attachment_event_fk", ["eventId"], "calendar_event", "cascade");
  await index("calendar_event_attachment_event_idx", "calendar_event_attachment", ["eventId"]);

  await db.schema
    .createTable("calendar_occurrence")
    .addColumn("eventId", "text", (c) => c.notNull())
    .addColumn("overrideEventId", "text")
    .addColumn("calendarId", "text", (c) => c.notNull())
    .addColumn("startAt", "timestamptz", (c) => c.notNull())
    .addColumn("endAt", "timestamptz", (c) => c.notNull())
    .addColumn("isAllDay", "boolean", (c) => c.notNull())
    .addColumn("startDate", "date")
    .addColumn("endDate", "date")
    .addColumn("status", "text", (c) => c.notNull())
    .addColumn("transparency", "text", (c) => c.notNull())
    .addPrimaryKeyConstraint("calendar_occurrence_pk", ["eventId", "startAt"])
    .execute();
  await foreignKey("calendar_occurrence", "calendar_occurrence_event_fk", ["eventId"], "calendar_event", "cascade");
  await foreignKey("calendar_occurrence", "calendar_occurrence_calendar_fk", ["calendarId"], "calendar", "cascade");
  await index("calendar_occurrence_range_idx", "calendar_occurrence", ["calendarId", "startAt", "endAt"]);

  // ── pending push + delivery ──────────────────────────────────────────────
  await db.schema
    .createTable("calendar_change")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("accountId", "text", (c) => c.notNull())
    .addColumn("calendarId", "text", (c) => c.notNull())
    .addColumn("eventId", "text", (c) => c.notNull())
    .addColumn("op", "text", (c) => c.notNull())
    .addColumn("recurrenceScope", "text", (c) => c.defaultTo("all").notNull())
    .addColumn("occurrenceStart", "timestamptz")
    .addColumn("fields", textArray, (c) => c.defaultTo(emptyTextArray).notNull())
    .addColumn("diff", jsonb, (c) => c.defaultTo(emptyObject).notNull())
    .addColumn("impact", jsonb, (c) => c.defaultTo(emptyObject).notNull())
    .addColumn("payload", jsonb, (c) => c.defaultTo(emptyObject).notNull())
    .addColumn("baseSnapshot", jsonb)
    .addColumn("baseEtag", "text")
    .addColumn("remoteChangedFields", textArray, (c) => c.defaultTo(emptyTextArray).notNull())
    .addColumn("remoteDeleted", "boolean", (c) => c.defaultTo(false).notNull())
    .addColumn("status", "text", (c) => c.notNull())
    .addColumn("createdByUserId", "text")
    .addColumn("decidedByUserId", "text")
    .addColumn("decidedAt", "timestamptz")
    .addColumn("attempts", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("nextAttemptAt", "timestamptz")
    .addColumn("lastError", "text")
    .addColumn("doneAt", "timestamptz")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();
  await foreignKey("calendar_change", "calendar_change_account_fk", ["accountId"], "connected_account", "cascade");
  await foreignKey("calendar_change", "calendar_change_event_fk", ["eventId"], "calendar_event", "cascade");
  await index("calendar_change_status_idx", "calendar_change", ["accountId", "status"]);
  await sql`create index calendar_change_queue_idx on calendar_change (status, "nextAttemptAt") where status in ('pending', 'sending')`.execute(db);
  await sql`create unique index calendar_change_open_idx on calendar_change ("eventId", "recurrenceScope", coalesce("occurrenceStart", 'epoch'::timestamptz)) where status = 'awaiting_approval'`.execute(
    db,
  );

  await db.schema
    .createTable("calendar_reminder_delivery")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("userId", "text", (c) => c.notNull())
    .addColumn("eventId", "text", (c) => c.notNull())
    .addColumn("occurrenceStart", "timestamptz", (c) => c.notNull())
    .addColumn("minutesBefore", "integer", (c) => c.notNull())
    .addColumn("method", "text", (c) => c.notNull())
    .addColumn("firedAt", "timestamptz", (c) => c.notNull())
    .addColumn("dismissedAt", "timestamptz")
    .addColumn("snoozedUntil", "timestamptz")
    .addUniqueConstraint("calendar_reminder_delivery_unique", ["userId", "eventId", "occurrenceStart", "minutesBefore", "method"])
    .execute();
  await foreignKey("calendar_reminder_delivery", "calendar_reminder_delivery_event_fk", ["eventId"], "calendar_event", "cascade");
  await sql`create index calendar_reminder_snooze_idx on calendar_reminder_delivery ("snoozedUntil") where "snoozedUntil" is not null`.execute(db);

  await db.schema
    .createTable("calendar_imip_message")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("emailMessageId", "text", (c) => c.notNull())
    .addColumn("method", "text", (c) => c.notNull())
    .addColumn("uid", "text", (c) => c.notNull())
    .addColumn("sequence", "integer", (c) => c.defaultTo(0).notNull())
    .addColumn("eventId", "text")
    .addColumn("result", "text")
    .addColumn("processedAt", "timestamptz", (c) => c.notNull())
    .addUniqueConstraint("calendar_imip_message_unique", ["emailMessageId", "uid"])
    .execute();
  await foreignKey("calendar_imip_message", "calendar_imip_message_email_fk", ["emailMessageId"], "email_message", "cascade");
  await foreignKey("calendar_imip_message", "calendar_imip_message_event_fk", ["eventId"], "calendar_event", "set null");

  await db.schema
    .createTable("calendar_user_settings")
    .addColumn("userId", "text", (c) => c.notNull())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("settings", jsonb, (c) => c.defaultTo(emptyObject).notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addPrimaryKeyConstraint("calendar_user_settings_pk", ["userId", "organizationId"])
    .execute();
  await foreignKey("calendar_user_settings", "calendar_user_settings_user_fk", ["userId"], "user", "cascade");
};
