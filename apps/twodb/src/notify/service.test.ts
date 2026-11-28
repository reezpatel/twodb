import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import type { Kysely } from "kysely";
import { createSqliteDb } from "@twodb/core-data/db";
import { up as notificationsUp } from "../migrations/0008-notifications.js";
import { createNotifyService } from "./service.js";
import type { ControlPlaneDb } from "../db/sqlite.js";
import type { TwoDbConfig } from "../config.js";

let db: Kysely<ControlPlaneDb>;
const file = path.join(tmpdir(), `notify-test-${process.pid}.sqlite`);

const config = { VAPID_SUBJECT: "mailto:test@example.com" } as TwoDbConfig; // no VAPID keys → push disabled
const appBaseUrl = (slug: string) => `https://${slug}.twodb.io`;

before(async () => {
  db = createSqliteDb<ControlPlaneDb>({ file });
  await notificationsUp(db as unknown as Kysely<unknown>);
});

after(async () => {
  await db.destroy();
  for (const suffix of ["", "-wal", "-shm"]) rmSync(file + suffix, { force: true });
});

test("send stores a notification and resolves an app-relative deep link", async () => {
  const notify = createNotifyService(db, config, { appBaseUrl });
  const { notification, pushed } = await notify.send("twochat", {
    userId: "usr_1",
    kind: "mention",
    title: "Ada mentioned you",
    body: "hello @you",
    deepLink: "/chat?channel=ch_1&message=m_1",
  });
  assert.equal(pushed, 0); // push not configured without VAPID keys
  assert.equal(notification.app, "twochat");
  assert.equal(notification.deepLink, "https://twochat.twodb.io/chat?channel=ch_1&message=m_1");
  assert.equal(notification.readAt, null);

  const row = await db.selectFrom("notification").selectAll().where("id", "=", notification.id).executeTakeFirst();
  assert.equal(row?.user_id, "usr_1");
  assert.equal(row?.kind, "mention");
});

test("send keeps absolute deep links untouched", async () => {
  const notify = createNotifyService(db, config, { appBaseUrl });
  const { notification } = await notify.send("twochat", {
    userId: "usr_1",
    kind: "dm",
    title: "DM",
    body: "",
    deepLink: "https://chat.example.com/x",
  });
  assert.equal(notification.deepLink, "https://chat.example.com/x");
});

test("send validates input", async () => {
  const notify = createNotifyService(db, config, { appBaseUrl });
  await assert.rejects(() => notify.send("twochat", { userId: "usr_1", kind: "", title: "", body: "" }));
});

test("push is skipped when VAPID is not configured", async () => {
  const notify = createNotifyService(db, config, { appBaseUrl });
  assert.equal(notify.pushConfigured(), false);
  assert.equal(notify.vapidPublicKey(), null);
});

