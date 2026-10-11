import { sql } from "kysely";
import { db } from "../../auth";
import { logger } from "../logger";
import { broadcastEmailEvent } from "../../routes/email-ws";
import { accountCredentials, loadAccount, saveAccountCredentials, setAccountStatus } from "./accounts";
import { connectorFor } from "./connectors/registry";
import { buildMime } from "./mime";
import { storeEmailBytes } from "./storage";
import { recomputeThread } from "./threads";
import { EmailAuthError } from "./types";

// Outbox worker: claims due queued/scheduled rows with SKIP LOCKED, builds
// MIME locally, archives the raw bytes, hands them to the connector and
// records the outcome. A row stuck in "sending" is never resent blindly —
// the provider may have accepted it; Sent-folder sync reconciles it by
// Message-ID.

const MAX_ATTEMPTS = 5;
const BACKOFF_SEC = [60, 300, 1800, 3600];
const STUCK_MS = 5 * 60_000;

async function setStatus(messageId: string, values: Record<string, unknown>) {
  const row = await db
    .updateTable("email_message")
    .set({ ...values, updatedAt: new Date() })
    .where("id", "=", messageId)
    .returning(["id", "threadId", "accountId", "status", "lastError"])
    .executeTakeFirst();
  if (!row) return;
  await recomputeThread(row.threadId);
  await broadcastEmailEvent(row.accountId, { type: "message.status", accountId: row.accountId, threadId: row.threadId, messageId: row.id, status: row.status, lastError: row.lastError });
  await broadcastEmailEvent(row.accountId, { type: "thread.updated", accountId: row.accountId, threadIds: [row.threadId] });
}

async function recoverStuck() {
  const stuck = await db
    .selectFrom("email_message")
    .select("id")
    .where("status", "=", "sending")
    .where("updatedAt", "<", new Date(Date.now() - STUCK_MS))
    .execute();
  for (const s of stuck) {
    await setStatus(s.id, { status: "failed", lastError: "Send was interrupted — check the provider's Sent folder before retrying." });
  }
}

async function sendOne(messageId: string) {
  const message = await db.selectFrom("email_message").selectAll().where("id", "=", messageId).executeTakeFirst();
  if (!message) return;
  try {
    const account = await loadAccount(message.accountId);
    const thread = await db.selectFrom("email_thread").select(["providerThreadId"]).where("id", "=", message.threadId).executeTakeFirst();
    const { mime, envelope } = await buildMime(message, account, { keepBcc: account.kind === "gmail" });
    const rawMediaId = await storeEmailBytes({
      organizationId: message.organizationId,
      accountId: account.id,
      filename: `${message.subject.slice(0, 60).replace(/[^\w\- ]+/g, "") || "message"}.eml`,
      contentType: "message/rfc822",
      data: mime,
      raw: true,
    });
    await db.updateTable("email_message").set({ rawMediaId }).where("id", "=", message.id).execute();
    const result = await connectorFor(account.kind).send(
      { account, credentials: accountCredentials(account), saveCredentials: (next) => saveAccountCredentials(account.id, next) },
      mime,
      envelope,
      { providerThreadId: thread?.providerThreadId ?? message.providerThreadId },
    );
    const now = new Date();
    try {
      await db
        .updateTable("email_message")
        .set({ providerMessageId: result.providerMessageId ?? null, providerThreadId: result.providerThreadId ?? message.providerThreadId })
        .where("id", "=", message.id)
        .where("providerMessageId", "is", null)
        .execute();
    } catch (e) {
      logger.warn({ err: e, messageId }, "email: provider id already linked");
    }
    if (result.providerThreadId) {
      await db.updateTable("email_thread").set({ providerThreadId: result.providerThreadId }).where("id", "=", message.threadId).where("providerThreadId", "is", null).execute();
    }
    await setStatus(message.id, { status: "sent", sentAt: now, lastError: null, nextAttemptAt: null });
    logger.info({ messageId, accountId: account.id }, "email: sent");
  } catch (e) {
    const err = e as Error;
    logger.warn({ err, messageId }, "email: send failed");
    if (e instanceof EmailAuthError) {
      await setAccountStatus(message.accountId, "reauth_required", err.message);
      await setStatus(message.id, { status: "failed", lastError: `Authentication failed: ${err.message}` });
      return;
    }
    const attempts = message.attempts;
    if (attempts >= MAX_ATTEMPTS || err.message === "email_attachments_not_configured" || err.message === "account_not_found") {
      await setStatus(message.id, { status: "failed", lastError: err.message });
      return;
    }
    await setStatus(message.id, {
      status: "queued",
      lastError: err.message,
      nextAttemptAt: new Date(Date.now() + BACKOFF_SEC[Math.min(attempts - 1, BACKOFF_SEC.length - 1)] * 1000),
    });
  }
}

export async function runOutbox() {
  await recoverStuck();
  const claimed = await sql<{ id: string }>`
    update email_message set status = 'sending', "updatedAt" = now(), attempts = attempts + 1
    where id in (
      select id from email_message
      where "deletedAt" is null and (
        (status = 'queued' and "sendAfter" <= now() and ("nextAttemptAt" is null or "nextAttemptAt" <= now()))
        or (status = 'scheduled' and "scheduledAt" <= now())
      )
      order by "sendAfter" asc
      limit 5
      for update skip locked
    )
    returning id`.execute(db);
  for (const row of claimed.rows) {
    const msg = await db.selectFrom("email_message").select(["threadId", "accountId"]).where("id", "=", row.id).executeTakeFirst();
    if (msg) await broadcastEmailEvent(msg.accountId, { type: "message.status", accountId: msg.accountId, threadId: msg.threadId, messageId: row.id, status: "sending" });
    await sendOne(row.id);
  }
}
