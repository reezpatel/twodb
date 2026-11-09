import { createHash, randomBytes } from "node:crypto";
import { db } from "../../auth";
import { env } from "../../env";
import { logger } from "../logger";
import { calendarConnectorFor } from "./connectors/registry";
import { calendarCtx } from "./sync";
import type { AccountRow } from "./types";

// Optional push notifications (per account: syncMode = webhooks). A
// notification never carries data — it only pulls the calendar's next sync
// forward. Requires the deployment to be reachable over public HTTPS.

const RENEW_BEFORE_MS = 12 * 60 * 60_000;

export function webhookBase(): string | null {
  const base = env.auth.url.replace(/\/$/, "");
  return /^https:\/\//i.test(base) && !/localhost|127\.0\.0\.1|\.local\b/i.test(base) ? base : null;
}

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function ensureWatches(account: AccountRow) {
  const base = webhookBase();
  if (!base || account.syncMode !== "webhooks" || account.kind === "imap") return;
  const connector = calendarConnectorFor(account.kind);
  if (!connector.watch) return;
  const calendars = await db
    .selectFrom("calendar")
    .selectAll()
    .where("accountId", "=", account.id)
    .where("deletedAt", "is", null)
    .where("syncEnabled", "=", true)
    .execute();
  const existing = await db.selectFrom("connected_account_webhook").selectAll().where("accountId", "=", account.id).execute();
  const ctx = calendarCtx(account);
  for (const calendar of calendars) {
    const current = existing.find((w) => w.calendarId === calendar.id);
    if (current && current.expiresAt.getTime() - Date.now() > RENEW_BEFORE_MS) continue;
    if (current) {
      await connector.unwatch?.(ctx, current.channelId, current.resourceId).catch(() => {});
      await db.deleteFrom("connected_account_webhook").where("id", "=", current.id).execute();
    }
    const channelId = crypto.randomUUID();
    const token = randomBytes(24).toString("base64url");
    try {
      const res = await connector.watch(ctx, calendar, `${base}/api/calendar/webhooks/${account.kind}`, channelId, token);
      await db
        .insertInto("connected_account_webhook")
        .values({
          id: crypto.randomUUID(),
          organizationId: account.organizationId,
          accountId: account.id,
          calendarId: calendar.id,
          provider: account.kind,
          channelId,
          resourceId: res.resourceId,
          secretHash: hash(token),
          expiresAt: res.expiresAt,
          lastNotifiedAt: null,
          createdAt: new Date(),
        })
        .execute();
    } catch (e) {
      logger.warn({ err: e, accountId: account.id, calendarId: calendar.id }, "calendar: watch failed (polling continues)");
    }
  }
}

export async function stopWatches(account: AccountRow) {
  const rows = await db.selectFrom("connected_account_webhook").selectAll().where("accountId", "=", account.id).execute();
  if (!rows.length) return;
  const connector = calendarConnectorFor(account.kind);
  const ctx = calendarCtx(account);
  for (const w of rows) await connector.unwatch?.(ctx, w.channelId, w.resourceId).catch(() => {});
  await db.deleteFrom("connected_account_webhook").where("accountId", "=", account.id).execute();
}

/** Marks the watched calendar due now. Returns false for unknown / forged notifications. */
async function poke(webhook: { id: string; calendarId: string | null; accountId: string }) {
  await db.updateTable("connected_account_webhook").set({ lastNotifiedAt: new Date() }).where("id", "=", webhook.id).execute();
  await db.updateTable("connected_account").set({ calendarNextSyncAt: new Date() }).where("id", "=", webhook.accountId).execute();
}

export async function handleGoogleNotification(headers: Record<string, string | undefined>): Promise<boolean> {
  const channelId = headers["x-goog-channel-id"];
  const token = headers["x-goog-channel-token"];
  if (!channelId || !token) return false;
  const w = await db.selectFrom("connected_account_webhook").selectAll().where("channelId", "=", channelId).where("provider", "=", "google").executeTakeFirst();
  if (!w || w.secretHash !== hash(token)) return false;
  if (headers["x-goog-resource-state"] !== "sync") await poke(w);
  return true;
}

export async function handleMicrosoftNotification(body: { value?: { subscriptionId?: string; clientState?: string }[] }): Promise<number> {
  let n = 0;
  for (const item of body.value ?? []) {
    if (!item.subscriptionId || !item.clientState) continue;
    const w = await db
      .selectFrom("connected_account_webhook")
      .selectAll()
      .where("resourceId", "=", item.subscriptionId)
      .where("provider", "=", "microsoft")
      .executeTakeFirst();
    if (!w || w.secretHash !== hash(item.clientState)) continue;
    await poke(w);
    n++;
  }
  return n;
}
