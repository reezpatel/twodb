import { sql } from "kysely";
import { db } from "../../auth";
import { logger } from "../logger";
import { broadcastEmailEvent } from "../../routes/email-ws";
import { accountCredentials, loadAccount, saveAccountCredentials, setAccountStatus } from "./accounts";
import { connectorFor } from "./connectors/registry";
import { filterNewProviderIds, ingestBatch } from "./ingest";
import { runOutbox } from "./outbox";
import { wakeSnoozed } from "./threads";
import { EmailAuthError, type EmailAccountRow, type SyncContext } from "./types";

// Three lanes on one timer: outbox (every tick), per-account sync (head when
// due, then backfill batches within a time budget) and snooze wake-ups.
// A transaction-scoped advisory lock keeps one sync per account across
// server instances; head sync always runs before backfill so new mail is
// never starved by history.

const TICK_MS = 5_000;
const BACKFILL_BUDGET_MS = 20_000;
const MAX_PARALLEL_SYNCS = 3;
const ERROR_RETRY_MS = 5 * 60_000;

const running = new Set<string>();
let timer: ReturnType<typeof setInterval> | null = null;
let outboxBusy = false;
let snoozeTick = 0;

function contextFor(account: EmailAccountRow, backfill: boolean): SyncContext {
  const ctx: SyncContext = {
    account,
    credentials: accountCredentials(account),
    saveCredentials: async (next) => {
      ctx.credentials = next;
      await saveAccountCredentials(account.id, next);
    },
    filterNew: (ids) => filterNewProviderIds(account.id, ids),
    ingest: async (items) => {
      await ingestBatch(account, items, { backfill });
    },
  };
  return ctx;
}

async function runHead(account: EmailAccountRow) {
  const result = await connectorFor(account.kind).pullHead(contextFor(account, false));
  const now = new Date();
  const values: Record<string, unknown> = {
    syncCursor: JSON.stringify(result.cursor),
    lastSyncedAt: now,
    nextSyncAt: new Date(now.getTime() + account.syncIntervalSec * 1000),
    status: "active",
    lastError: null,
    updatedAt: now,
  };
  if (result.backfillCursor !== undefined) {
    values.backfillCursor = JSON.stringify(result.backfillCursor);
    values.backfillState = account.backfillState === "paused" ? "paused" : "running";
    values.backfillProgress = JSON.stringify({ done: 0, total: result.total ?? null, startedAt: now.toISOString() });
  }
  await db.updateTable("connected_account").set(values).where("id", "=", account.id).execute();
  if (account.status !== "active") await broadcastEmailEvent(account.id, { type: "account.status", accountId: account.id, status: "active", lastError: null });
}

async function runBackfill(accountId: string) {
  const started = Date.now();
  while (Date.now() - started < BACKFILL_BUDGET_MS) {
    const account = await loadAccount(accountId);
    if (account.backfillState !== "running") return;
    const prev = account.backfillProgress as { startedAt?: string; total?: number | null };
    const step = await connectorFor(account.kind).pullBackfill(contextFor(account, true));
    const state = step.cursor ? "running" : "done";
    const progress = {
      done: step.done,
      total: step.cursor ? (step.total ?? prev.total ?? null) : step.done,
      startedAt: prev.startedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(state === "done" ? { finishedAt: new Date().toISOString() } : {}),
    };
    await db
      .updateTable("connected_account")
      .set({ backfillCursor: JSON.stringify(step.cursor), backfillState: state, backfillProgress: JSON.stringify(progress), updatedAt: new Date() })
      .where("id", "=", account.id)
      .execute();
    await broadcastEmailEvent(account.id, { type: "account.backfill", accountId: account.id, state, progress });
    if (state === "done") return;
  }
}

/** Head (if due or forced) then a time-boxed backfill slice, under an account-wide advisory lock. */
export async function syncAccount(accountId: string, opts: { force?: boolean } = {}) {
  if (running.has(accountId)) return;
  running.add(accountId);
  try {
    await db.transaction().execute(async (trx) => {
      const lock = await sql<{ ok: boolean }>`select pg_try_advisory_xact_lock(hashtext(${`email:${accountId}`})) as ok`.execute(trx);
      if (!lock.rows[0]?.ok) return;
      const account = await loadAccount(accountId);
      if (!account.credentials || !account.capabilities.includes("mail") || account.status === "paused" || account.status === "reauth_required") return;
      try {
        if (opts.force || !account.nextSyncAt || account.nextSyncAt <= new Date()) await runHead(account);
        await runBackfill(accountId);
      } catch (e) {
        const err = e as Error;
        logger.warn({ err, accountId }, "email: sync failed");
        if (e instanceof EmailAuthError) {
          await setAccountStatus(accountId, "reauth_required", err.message);
        } else {
          await db
            .updateTable("connected_account")
            .set({ nextSyncAt: new Date(Date.now() + ERROR_RETRY_MS) })
            .where("id", "=", accountId)
            .execute();
          await setAccountStatus(accountId, "error", err.message);
        }
      }
    });
  } catch (e) {
    logger.error({ err: e, accountId }, "email: sync crashed");
  } finally {
    running.delete(accountId);
  }
}

async function tick() {
  if (!outboxBusy) {
    outboxBusy = true;
    runOutbox()
      .catch((e) => logger.error({ err: e }, "email: outbox tick failed"))
      .finally(() => {
        outboxBusy = false;
      });
  }

  if (++snoozeTick % 6 === 0) {
    const woke = await wakeSnoozed();
    for (const [accountId, threadIds] of woke) await broadcastEmailEvent(accountId, { type: "thread.updated", accountId, threadIds });
  }

  const due = await db
    .selectFrom("connected_account")
    .select("id")
    .where("deletedAt", "is", null)
    .where("credentials", "is not", null)
    .where(sql<boolean>`'mail' = any(capabilities)`)
    .where("status", "not in", ["paused", "reauth_required"])
    .where((eb) => eb.or([eb("nextSyncAt", "is", null), eb("nextSyncAt", "<=", new Date()), eb("backfillState", "=", "running")]))
    .orderBy("nextSyncAt")
    .limit(20)
    .execute();
  for (const { id } of due) {
    if (running.size >= MAX_PARALLEL_SYNCS) break;
    if (!running.has(id)) void syncAccount(id);
  }
}

export function startEmailScheduler() {
  if (timer || ["1", "true", "yes"].includes((process.env.TWODB_EMAIL_SYNC_DISABLED ?? "").toLowerCase())) return;
  timer = setInterval(() => {
    tick().catch((e) => logger.error({ err: e }, "email: scheduler tick failed"));
  }, TICK_MS);
  logger.info("email scheduler started");
}

export function stopEmailScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
