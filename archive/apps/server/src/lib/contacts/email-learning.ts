import { sql } from "kysely";
import { db } from "../../auth";
import { logger } from "../logger";
import type { EmailAddress } from "../../plugins/db";
import type { EmailAccountRow } from "../email/types";
import { ensureAccountBook } from "./books";
import { isBulkMail, learnContacts } from "./learn";

// Mail → contacts. Sent mail is the strongest signal, replies next, plain
// received mail is weak; bulk/list senders are kept as kind=list (hidden).
// Spam and trash never teach anything.

const BATCH = 500;

export interface LearnableMessage {
  direction: string;
  fromAddress: string | null;
  fromName: string | null;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  headers: Record<string, string>;
  sentAt: Date | null;
  inReplyTo: string | null;
}

export function selfAddresses(account: Pick<EmailAccountRow, "address" | "aliases">): Set<string> {
  return new Set([account.address, ...account.aliases].map((a) => a.toLowerCase()));
}

export async function learnFromMessage(
  account: Pick<EmailAccountRow, "id" | "organizationId" | "ownerUserId" | "address" | "aliases">,
  bookId: string | null,
  m: LearnableMessage,
) {
  const book = bookId ?? (await ensureAccountBook(account.organizationId, account.id, account.ownerUserId));
  const self = selfAddresses(account);
  const at = m.sentAt ?? new Date();
  const base = { organizationId: account.organizationId, bookId: book, at, source: "email" as const, self };

  if (m.direction === "outbound") {
    await learnContacts({ ...base, people: [...m.to, ...m.cc, ...m.bcc].map((p) => ({ email: p.address, name: p.name })), interaction: "sent" });
    if (m.inReplyTo) {
      const original = await db
        .selectFrom("email_message")
        .select(["fromAddress", "fromName"])
        .where("accountId", "=", account.id)
        .where("rfcMessageId", "=", m.inReplyTo)
        .where("direction", "=", "inbound")
        .executeTakeFirst();
      if (original?.fromAddress) await learnContacts({ ...base, people: [{ email: original.fromAddress, name: original.fromName }], interaction: "replied" });
    }
    return;
  }

  if (!m.fromAddress) return;
  if (isBulkMail(m.headers)) {
    await learnContacts({ ...base, people: [{ email: m.fromAddress, name: m.fromName }], interaction: "received", kind: "list" });
    return;
  }
  const direct = [...m.to, ...m.cc].some((p) => self.has(p.address.toLowerCase()));
  if (!direct) return;
  await learnContacts({ ...base, people: [{ email: m.fromAddress, name: m.fromName }], interaction: "received" });
  if (m.cc.length) await learnContacts({ ...base, people: [...m.to, ...m.cc].map((p) => ({ email: p.address, name: p.name })), interaction: "cc_received" });
}

/** Learns from a freshly ingested/sent message, skipping spam threads. Never throws into the mail path. */
export async function learnFromMessageId(account: EmailAccountRow, messageId: string) {
  try {
    const row = await db
      .selectFrom("email_message")
      .innerJoin("email_thread", "email_thread.id", "email_message.threadId")
      .select([
        "email_message.direction",
        "email_message.fromAddress",
        "email_message.fromName",
        "email_message.to",
        "email_message.cc",
        "email_message.bcc",
        "email_message.headers",
        "email_message.sentAt",
        "email_message.inReplyTo",
        "email_thread.location",
      ])
      .where("email_message.id", "=", messageId)
      .executeTakeFirst();
    if (!row || row.location === "spam") return;
    await learnFromMessage(account, null, row);
  } catch (e) {
    logger.warn({ err: e, messageId }, "contacts: learning from message failed");
  }
}

/**
 * One-time pass over mail already stored before contacts existed (and after
 * an account is connected, alongside the mail backfill). Resumable: the
 * cursor lives in contact_book.learnProgress.
 */
export async function runLearnBackfill(bookId: string, budgetMs = 15_000): Promise<boolean> {
  const book = await db.selectFrom("contact_book").selectAll().where("id", "=", bookId).executeTakeFirst();
  if (!book?.accountId || book.learnState === "done" || book.deletedAt) return true;
  const account = await db.selectFrom("connected_account").selectAll().where("id", "=", book.accountId).executeTakeFirst();
  if (!account || account.deletedAt) return true;
  const progress = book.learnProgress as { cursor?: string; done?: number; total?: number };
  const started = Date.now();
  let cursor = progress.cursor ?? "";
  let done = progress.done ?? 0;
  const total =
    progress.total ??
    Number(
      (
        await db
          .selectFrom("email_message")
          .select(({ fn }) => fn.countAll<string>().as("n"))
          .where("accountId", "=", account.id)
          .where("purgedAt", "is", null)
          .where("status", "in", ["sent", "received"])
          .where("createdAt", "<", book.createdAt)
          .executeTakeFirst()
      )?.n ?? 0,
    );

  while (Date.now() - started < budgetMs) {
    const rows = await db
      .selectFrom("email_message")
      .innerJoin("email_thread", "email_thread.id", "email_message.threadId")
      .select([
        "email_message.id",
        "email_message.direction",
        "email_message.fromAddress",
        "email_message.fromName",
        "email_message.to",
        "email_message.cc",
        "email_message.bcc",
        "email_message.headers",
        "email_message.sentAt",
        "email_message.inReplyTo",
        "email_thread.location",
      ])
      .where("email_message.accountId", "=", account.id)
      .where("email_message.purgedAt", "is", null)
      .where("email_message.status", "in", ["sent", "received"])
      .where("email_message.id", ">", cursor)
      // Messages stored after the book existed were learned live at ingest.
      .where("email_message.createdAt", "<", book.createdAt)
      .orderBy("email_message.id")
      .limit(BATCH)
      .execute();
    for (const r of rows) {
      if (r.location !== "spam") await learnFromMessage(account, bookId, r);
    }
    done += rows.length;
    cursor = rows.at(-1)?.id ?? cursor;
    const finished = rows.length < BATCH;
    await db
      .updateTable("contact_book")
      .set({ learnState: finished ? "done" : "running", learnProgress: JSON.stringify({ cursor, done, total }), updatedAt: new Date() })
      .where("id", "=", bookId)
      .execute();
    if (finished) return true;
  }
  return false;
}

export async function pendingLearnBooks(): Promise<string[]> {
  const rows = await db
    .selectFrom("contact_book")
    .select("id")
    .where("kind", "=", "account")
    .where("learnState", "in", ["pending", "running"])
    .where("deletedAt", "is", null)
    .where(
      sql<boolean>`exists (select 1 from connected_account a where a.id = contact_book."accountId" and 'mail' = any(a.capabilities) and a."deletedAt" is null)`,
    )
    .limit(5)
    .execute();
  return rows.map((r) => r.id);
}
