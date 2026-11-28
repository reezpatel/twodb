import type { Kysely } from "kysely";

/**
 * Cross-app notifications + Web Push subscriptions. Owned by the control
 * plane (not any app) for the same reason identity is: a user's inbox and
 * their devices aren't app data. Apps send via POST /api/notify/send and
 * receive durable `twodb.notify.deliver` jobs on their own `/_svc/inbox`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("notification")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("user_id", "text", (c) => c.notNull())
    /** Slug of the app that sent it (verified from the caller's app token — never client-supplied). */
    .addColumn("app", "text", (c) => c.notNull())
    .addColumn("kind", "text", (c) => c.notNull())
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("body", "text", (c) => c.notNull().defaultTo(""))
    /** Resolved absolute URL (or null) opened when the notification is clicked. */
    .addColumn("deep_link", "text")
    .addColumn("read_at", "text")
    .addColumn("created_at", "text", (c) => c.notNull())
    .execute();
  await db.schema
    .createIndex("notification_user_created_idx")
    .ifNotExists()
    .on("notification")
    .columns(["user_id", "created_at"])
    .execute();
  await db.schema
    .createIndex("notification_user_app_idx")
    .ifNotExists()
    .on("notification")
    .columns(["user_id", "app"])
    .execute();

  await db.schema
    .createTable("push_subscription")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("user_id", "text", (c) => c.notNull())
    /** The browser push endpoint — unique per device+origin, so it's the natural dedupe key. */
    .addColumn("endpoint", "text", (c) => c.notNull().unique())
    .addColumn("p256dh", "text", (c) => c.notNull())
    .addColumn("auth", "text", (c) => c.notNull())
    /** Which app origin registered the subscription (twochat, twomail, …) — a push only fires for that app's notifications. */
    .addColumn("app", "text", (c) => c.notNull())
    .addColumn("device_label", "text")
    .addColumn("created_at", "text", (c) => c.notNull())
    .execute();
  await db.schema
    .createIndex("push_subscription_user_app_idx")
    .ifNotExists()
    .on("push_subscription")
    .columns(["user_id", "app"])
    .execute();
}

