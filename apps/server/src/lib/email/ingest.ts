import { db } from "../../auth";
import { logger } from "../logger";
import { broadcastEmailEvent } from "../../routes/email-ws";
import { parseRaw, type NormalizedMessage } from "./parse";
import { storeEmailBytes } from "./storage";
import { findThread, normalizeSubject } from "./threading";
import { recomputeThread, senderIsSpam } from "./threads";
import type { EmailAccountRow, RawIncoming } from "./types";

// Single inbound path for every connector: dedupe → parse → reconcile our own
// outbound → store raw → thread → insert → attachments → recompute → events.

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

function isUniqueViolation(e: unknown) {
  return (e as { code?: string })?.code === "23505";
}

export function ownAddresses(account: Pick<EmailAccountRow, "address" | "aliases">): Set<string> {
  return new Set([account.address, ...account.aliases].map((a) => a.toLowerCase()));
}

export async function filterNewProviderIds(accountId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const known = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const rows = await db
      .selectFrom("email_message")
      .select("providerMessageId")
      .where("accountId", "=", accountId)
      .where("providerMessageId", "in", ids.slice(i, i + 500))
      .execute();
    for (const r of rows) if (r.providerMessageId) known.add(r.providerMessageId);
  }
  return ids.filter((id) => !known.has(id));
}

/** Our outbound copy came back through Sent sync — link it instead of duplicating. */
async function reconcileExisting(account: EmailAccountRow, item: RawIncoming, parsed: NormalizedMessage): Promise<string | null> {
  const existing = await db
    .selectFrom("email_message")
    .selectAll()
    .where("accountId", "=", account.id)
    .where("rfcMessageId", "=", parsed.rfcMessageId)
    .orderBy("createdAt", "asc")
    .executeTakeFirst();
  if (!existing) return null;
  if (existing.direction === "outbound" && !existing.providerMessageId) {
    try {
      await db
        .updateTable("email_message")
        .set({
          providerMessageId: item.providerMessageId,
          providerThreadId: item.providerThreadId ?? existing.providerThreadId,
          ...(existing.status === "sending" || existing.status === "failed" ? { status: "sent", lastError: null, sentAt: existing.sentAt ?? parsed.date ?? new Date() } : {}),
          updatedAt: new Date(),
        })
        .where("id", "=", existing.id)
        .execute();
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
    if (item.providerThreadId) {
      await db.updateTable("email_thread").set({ providerThreadId: item.providerThreadId }).where("id", "=", existing.threadId).where("providerThreadId", "is", null).execute();
    }
  }
  return existing.threadId;
}

export async function ingestBatch(account: EmailAccountRow, items: RawIncoming[], opts: { backfill: boolean }): Promise<{ inserted: number }> {
  const touched = new Set<string>();
  const created: { threadId: string; messageId: string }[] = [];
  const own = ownAddresses(account);

  for (const item of items) {
    try {
      const dupe = await db
        .selectFrom("email_message")
        .select("id")
        .where("accountId", "=", account.id)
        .where("providerMessageId", "=", item.providerMessageId)
        .executeTakeFirst();
      if (dupe) continue;

      const parsed = await parseRaw(item.raw);
      const reconciled = await reconcileExisting(account, item, parsed);
      if (reconciled) {
        touched.add(reconciled);
        continue;
      }

      const outbound = item.isSent || (!!parsed.from && own.has(parsed.from.address) && !parsed.to.some((r) => own.has(r.address)));
      const date = parsed.date ?? item.internalDate ?? new Date();
      const rawMediaId = await storeEmailBytes({
        organizationId: account.organizationId,
        accountId: account.id,
        filename: `${(parsed.subject || "message").slice(0, 60).replace(/[^\w\- ]+/g, "")}.eml`,
        contentType: "message/rfc822",
        data: item.raw,
        raw: true,
      });

      const participants = [parsed.from, ...parsed.to, ...parsed.cc].filter((v): v is NonNullable<typeof v> => !!v);
      let threadId = await findThread({
        accountId: account.id,
        inReplyTo: parsed.inReplyTo,
        references: parsed.references,
        providerThreadId: item.providerThreadId ?? null,
        subject: parsed.subject,
        participants,
      });
      const spam = !outbound && (await senderIsSpam(account.id, parsed.from?.address ?? null));
      const now = new Date();
      if (!threadId) {
        threadId = crypto.randomUUID();
        await db
          .insertInto("email_thread")
          .values({
            id: threadId,
            organizationId: account.organizationId,
            accountId: account.id,
            providerThreadId: item.providerThreadId ?? null,
            subject: normalizeSubject(parsed.subject),
            location: outbound ? "archive" : spam ? "spam" : "inbox",
            lastMessageAt: date,
            participants: JSON.stringify(participants),
            snippet: parsed.snippet,
            createdAt: now,
            updatedAt: now,
          })
          .execute();
      } else if (!outbound && !opts.backfill) {
        const thread = await db.selectFrom("email_thread").select(["location", "mutedAt", "deletedAt"]).where("id", "=", threadId).executeTakeFirstOrThrow();
        const location = spam ? "spam" : thread.location === "spam" || thread.mutedAt ? thread.location : "inbox";
        await db
          .updateTable("email_thread")
          .set({ location, ...(thread.deletedAt && !thread.mutedAt ? { deletedAt: null, deletedByUserId: null } : {}) })
          .where("id", "=", threadId)
          .execute();
      }

      const messageId = crypto.randomUUID();
      try {
        await db
          .insertInto("email_message")
          .values({
            id: messageId,
            organizationId: account.organizationId,
            accountId: account.id,
            threadId,
            direction: outbound ? "outbound" : "inbound",
            status: outbound ? "sent" : "received",
            composeKind: null,
            sourceMessageId: null,
            providerMessageId: item.providerMessageId,
            providerThreadId: item.providerThreadId ?? null,
            rfcMessageId: parsed.rfcMessageId,
            inReplyTo: parsed.inReplyTo,
            references: parsed.references,
            fromAddress: parsed.from?.address ?? null,
            fromName: parsed.from?.name ?? null,
            to: JSON.stringify(parsed.to),
            cc: JSON.stringify(parsed.cc),
            bcc: JSON.stringify(parsed.bcc),
            replyTo: JSON.stringify(parsed.replyTo),
            subject: parsed.subject,
            snippet: parsed.snippet,
            bodyText: parsed.text,
            bodyHtml: parsed.html,
            headers: JSON.stringify(parsed.headers),
            rawMediaId,
            sentAt: date,
            receivedAt: item.internalDate ?? date,
            scheduledAt: null,
            sendAfter: null,
            nextAttemptAt: null,
            lastError: null,
            isRead: outbound || item.isRead,
            sentByUserId: null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            deletedByUserId: null,
            purgedAt: null,
          })
          .execute();
      } catch (e) {
        if (isUniqueViolation(e)) continue;
        throw e;
      }

      for (const att of parsed.attachments) {
        const tooBig = att.size > MAX_ATTACHMENT_BYTES;
        const mediaId = tooBig
          ? null
          : await storeEmailBytes({
              organizationId: account.organizationId,
              accountId: account.id,
              filename: att.filename,
              contentType: att.contentType,
              data: att.content,
            });
        await db
          .insertInto("email_attachment")
          .values({
            id: crypto.randomUUID(),
            organizationId: account.organizationId,
            messageId,
            mediaId,
            filename: att.filename,
            contentType: att.contentType,
            size: att.size,
            contentId: att.contentId,
            isInline: att.isInline,
            status: tooBig ? "skipped" : "stored",
            createdAt: now,
          })
          .execute();
      }
      touched.add(threadId);
      created.push({ threadId, messageId });
    } catch (e) {
      if ((e as Error).message === "email_attachments_not_configured") throw e;
      logger.error({ err: e, accountId: account.id, providerMessageId: item.providerMessageId }, "email: ingest failed for message");
    }
  }

  for (const id of touched) await recomputeThread(id);
  if (touched.size) await broadcastEmailEvent(account.id, { type: "thread.updated", accountId: account.id, threadIds: [...touched] });
  if (!opts.backfill) {
    for (const c of created) await broadcastEmailEvent(account.id, { type: "message.created", accountId: account.id, ...c });
  }
  return { inserted: created.length };
}
