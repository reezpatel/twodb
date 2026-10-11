import { sql } from "kysely";
import { db } from "../../auth";
import { logger } from "../logger";
import { EmailAuthError } from "../email/types";
import { setCalendarState } from "../email/accounts";
import { pendingLearnBooks, runLearnBackfill } from "../contacts/email-learning";
import { syncSubscription } from "./calendars";
import { accountsWithDueChanges, dueChanges, exportChange, recoverStuckChanges } from "./export";
import { slideWindows } from "./occurrences";
import { runReminders } from "./reminders";
import { syncCalendarEvents, syncCalendarList } from "./sync";
import { ensureWatches, stopWatches } from "./webhooks";
import type { AccountRow } from "./types";

// Calendar lanes on one timer: approved pushes (export) and imports share a
// per-account advisory lock so they never interleave; reminders every tick;
// subscriptions, window sliding and the contacts learning pass in the
// background.

const TICK_MS = 10_000;
const POLL_VISIBLE_SEC = 60;
const POLL_WEBHOOK_SEC = 15 * 60;
const LIST_EVERY_MS = 10 * 60_000;
const SUBSCRIPTION_EVERY_MS = 6 * 60 * 60_000;
const ERROR_RETRY_MS = 5 * 60_000;
const MAX_PARALLEL = 3;

const running = new Set<string>();
let timer: ReturnType<typeof setInterval> | null = null;
let ticks = 0;
let busy = false;

async function withAccountLock(accountId: string, fn: () => Promise<void>) {
  if (running.has(accountId)) return;
  running.add(accountId);
  try {
    await db.transaction().execute(async (trx) => {
      const lock = await sql<{ ok: boolean }>`select pg_try_advisory_xact_lock(hashtext(${`calendar:${accountId}`})) as ok`.execute(trx);
      if (!lock.rows[0]?.ok) return;
      await fn();
    });
  } finally {
    running.delete(accountId);
  }
}

async function loadAccount(accountId: string): Promise<AccountRow | undefined> {
  return db.selectFrom("connected_account").selectAll().where("id", "=", accountId).executeTakeFirst();
}

/** Imports one account's calendars (list when due, then each enabled calendar). */
export async function syncAccountCalendars(accountId: string, opts: { force?: boolean } = {}) {
  await withAccountLock(accountId, async () => {
    let account = await loadAccount(accountId);
    if (!account || account.deletedAt || !account.credentials || !account.capabilities.includes("calendar")) return;
    if (["paused", "reauth_required", "disabled"].includes(account.calendarState) && !opts.force) return;
    try {
      // Approved pushes first so the import sees our own writes.
      for (const id of await dueChanges(accountId)) await exportChange(id);

      if (opts.force || !account.calendarListSyncedAt || Date.now() - account.calendarListSyncedAt.getTime() > LIST_EVERY_MS) await syncCalendarList(account);
      account = (await loadAccount(accountId))!;
      const calendars = await db
        .selectFrom("calendar")
        .selectAll()
        .where("accountId", "=", accountId)
        .where("deletedAt", "is", null)
        .where("syncEnabled", "=", true)
        .execute();
      const firstImport = account.calendarImportState !== "done";
      if (firstImport) {
        await db
          .updateTable("connected_account")
          .set({
            calendarImportState: "running",
            calendarImportProgress: JSON.stringify({ done: 0, calendars: calendars.length, startedAt: new Date().toISOString() }),
          })
          .where("id", "=", accountId)
          .execute();
      }
      let done = 0;
      for (const [i, calendar] of calendars.entries()) {
        done += await syncCalendarEvents(account, calendar, {
          onProgress: firstImport
            ? async (n) => {
                await db
                  .updateTable("connected_account")
                  .set({
                    calendarImportProgress: JSON.stringify({
                      done: done + n,
                      calendar: i + 1,
                      calendars: calendars.length,
                      updatedAt: new Date().toISOString(),
                    }),
                  })
                  .where("id", "=", accountId)
                  .execute();
              }
            : undefined,
        });
      }
      const now = new Date();
      const interval = account.syncMode === "webhooks" ? POLL_WEBHOOK_SEC : POLL_VISIBLE_SEC;
      await db
        .updateTable("connected_account")
        .set({
          calendarState: "active",
          calendarError: null,
          calendarLastSyncedAt: now,
          calendarNextSyncAt: new Date(now.getTime() + interval * 1000),
          ...(firstImport
            ? { calendarImportState: "done", calendarImportProgress: JSON.stringify({ done, calendars: calendars.length, finishedAt: now.toISOString() }) }
            : {}),
        })
        .where("id", "=", accountId)
        .execute();
      if (account.syncMode === "webhooks") await ensureWatches(account);
      else await stopWatches(account);
    } catch (e) {
      const err = e as Error;
      logger.warn({ err, accountId }, "calendar: sync failed");
      if (e instanceof EmailAuthError) await setCalendarState(accountId, "reauth_required", err.message);
      else {
        await db
          .updateTable("connected_account")
          .set({ calendarNextSyncAt: new Date(Date.now() + ERROR_RETRY_MS) })
          .where("id", "=", accountId)
          .execute();
        await setCalendarState(accountId, "error", err.message.slice(0, 500));
      }
    }
  });
}

async function tick() {
  ticks++;
  await runReminders().catch((e) => logger.error({ err: e }, "calendar: reminders failed"));
  if (ticks % 6 === 1) await recoverStuckChanges();

  // Approved pushes for accounts that aren't otherwise due.
  for (const accountId of await accountsWithDueChanges()) {
    if (running.size >= MAX_PARALLEL) break;
    void withAccountLock(accountId, async () => {
      for (const id of await dueChanges(accountId)) await exportChange(id);
    }).catch((e) => logger.error({ err: e, accountId }, "calendar: export crashed"));
  }

  const due = await db
    .selectFrom("connected_account")
    .select("id")
    .where("deletedAt", "is", null)
    .where("credentials", "is not", null)
    .where(sql<boolean>`'calendar' = any(capabilities)`)
    .where("calendarState", "in", ["active", "error"])
    .where((eb) => eb.or([eb("calendarNextSyncAt", "is", null), eb("calendarNextSyncAt", "<=", new Date())]))
    .orderBy("calendarNextSyncAt")
    .limit(10)
    .execute();
  for (const { id } of due) {
    if (running.size >= MAX_PARALLEL) break;
    void syncAccountCalendars(id).catch((e) => logger.error({ err: e, accountId: id }, "calendar: sync crashed"));
  }

  if (ticks % 30 === 2) {
    const subs = await db
      .selectFrom("calendar")
      .select("id")
      .where("kind", "=", "subscription")
      .where("deletedAt", "is", null)
      .where((eb) => eb.or([eb("lastSyncedAt", "is", null), eb("lastSyncedAt", "<", new Date(Date.now() - SUBSCRIPTION_EVERY_MS))]))
      .limit(5)
      .execute();
    for (const s of subs) {
      await syncSubscription(s.id).catch(async (e) => {
        await db
          .updateTable("calendar")
          .set({ lastError: (e as Error).message, lastSyncedAt: new Date() })
          .where("id", "=", s.id)
          .execute();
      });
    }
  }
  if (ticks % 3 === 0) for (const bookId of await pendingLearnBooks()) await runLearnBackfill(bookId, 8_000);
  if (ticks % 8640 === 5) await slideWindows().catch((e) => logger.warn({ err: e }, "calendar: window slide failed"));
}

export function startCalendarScheduler() {
  if (timer || ["1", "true", "yes"].includes((process.env.TWODB_CALENDAR_SYNC_DISABLED ?? process.env.TWODB_EMAIL_SYNC_DISABLED ?? "").toLowerCase())) return;
  timer = setInterval(() => {
    if (busy) return;
    busy = true;
    tick()
      .catch((e) => logger.error({ err: e }, "calendar: scheduler tick failed"))
      .finally(() => {
        busy = false;
      });
  }, TICK_MS);
  logger.info("calendar scheduler started");
}

export function stopCalendarScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
