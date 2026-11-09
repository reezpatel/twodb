import { db } from "../../auth";
import type { EmailAddress } from "../../plugins/db";
import { accessibleAccounts, EmailAccessError, requireAccountRole, requireMessage } from "./access";
import { loadAccount } from "./accounts";
import { ownAddresses } from "./ingest";
import { htmlToText, makeSnippet } from "./parse";
import { releaseEmailMedia, storeEmailBytes } from "./storage";
import { normalizeSubject, prefixedSubject } from "./threading";
import { hardDeleteMessage, recomputeThread } from "./threads";

// Drafts are local email_message rows (status=draft). Reply/forward drafts
// are prefilled server-side; the quote is appended at send time from
// sourceMessageId so the editor only holds what the user wrote.

export type ComposeKind = "new" | "reply" | "reply_all" | "forward";

const UNDO_SECONDS = 10;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const ADDRESS_RE = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;

function dedupeAddresses(list: EmailAddress[], exclude: Set<string>): EmailAddress[] {
  const seen = new Set(exclude);
  const out: EmailAddress[] = [];
  for (const a of list) {
    const key = a.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: a.name, address: key });
  }
  return out;
}

function signatureBlock(signatureHtml: string | null): string {
  return signatureHtml ? `<p></p><p>-- </p>${signatureHtml}` : "";
}

export async function createDraft(
  organizationId: string,
  userId: string,
  input: { composeKind?: ComposeKind; sourceMessageId?: string | null; accountId?: string | null; to?: EmailAddress[]; subject?: string },
) {
  const kind: ComposeKind = input.composeKind ?? "new";
  const now = new Date();

  if (kind !== "new") {
    if (!input.sourceMessageId) throw new EmailAccessError(400, "source_message_required");
    const source = await requireMessage(organizationId, userId, input.sourceMessageId, "member");
    if (kind !== "forward") {
      const existing = await db
        .selectFrom("email_message")
        .select("id")
        .where("threadId", "=", source.threadId)
        .where("status", "=", "draft")
        .where("sentByUserId", "=", userId)
        .where("composeKind", "in", ["reply", "reply_all"])
        .executeTakeFirst();
      if (existing) return existing.id;
    }
    const account = await loadAccount(source.accountId);
    const own = ownAddresses(account);
    const sourceFrom = source.fromAddress ? [{ name: source.fromName, address: source.fromAddress }] : [];
    const fromMe = source.direction === "outbound";
    let to: EmailAddress[] = [];
    let cc: EmailAddress[] = [];
    if (kind === "reply" || kind === "reply_all") {
      const primary = fromMe ? source.to : source.replyTo.length ? source.replyTo : sourceFrom;
      to = dedupeAddresses(primary, fromMe ? new Set() : own);
      if (kind === "reply_all") {
        const toSet = new Set(to.map((a) => a.address));
        cc = dedupeAddresses([...(fromMe ? [] : source.to), ...source.cc], new Set([...own, ...toSet]));
      }
    }
    const fromAddress = [...own].find((a) => [...source.to, ...source.cc].some((r) => r.address === a)) ?? account.address;
    const id = crypto.randomUUID();
    await db
      .insertInto("email_message")
      .values({
        id,
        organizationId,
        accountId: account.id,
        threadId: source.threadId,
        direction: "outbound",
        status: "draft",
        composeKind: kind,
        sourceMessageId: source.id,
        providerMessageId: null,
        providerThreadId: source.providerThreadId,
        rfcMessageId: null,
        inReplyTo: kind === "forward" ? null : source.rfcMessageId,
        references: [...source.references, ...(source.rfcMessageId ? [source.rfcMessageId] : [])].slice(-30),
        fromAddress,
        fromName: account.displayName,
        to: JSON.stringify(to),
        cc: JSON.stringify(cc),
        bcc: "[]",
        replyTo: "[]",
        subject: prefixedSubject(source.subject || "(no subject)", kind === "forward" ? "Fwd" : "Re"),
        snippet: null,
        bodyText: null,
        bodyHtml: `<p></p>${signatureBlock(account.signatureHtml)}`,
        headers: JSON.stringify({ "x-twodb-include-quote": "1" }),
        rawMediaId: null,
        sentAt: null,
        receivedAt: null,
        scheduledAt: null,
        sendAfter: null,
        nextAttemptAt: null,
        lastError: null,
        isRead: true,
        sentByUserId: userId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        deletedByUserId: null,
        purgedAt: null,
      })
      .execute();
    if (kind === "forward") {
      const atts = await db.selectFrom("email_attachment").selectAll().where("messageId", "=", source.id).where("mediaId", "is not", null).execute();
      for (const a of atts) {
        await db
          .insertInto("email_attachment")
          .values({ ...a, id: crypto.randomUUID(), messageId: id, createdAt: now })
          .execute();
      }
    }
    await recomputeThread(source.threadId);
    return id;
  }

  const roles = await accessibleAccounts(organizationId, userId);
  const accountId = input.accountId ?? [...roles.entries()].find(([, r]) => r !== "viewer")?.[0];
  if (!accountId) throw new EmailAccessError(400, "no_sending_account");
  await requireAccountRole(organizationId, userId, accountId, "member");
  const account = await loadAccount(accountId);
  const threadId = crypto.randomUUID();
  const id = crypto.randomUUID();
  await db
    .insertInto("email_thread")
    .values({
      id: threadId,
      organizationId,
      accountId,
      providerThreadId: null,
      subject: normalizeSubject(input.subject ?? ""),
      location: "archive",
      lastMessageAt: now,
      participants: "[]",
      snippet: null,
      createdAt: now,
      updatedAt: now,
    })
    .execute();
  await db
    .insertInto("email_message")
    .values({
      id,
      organizationId,
      accountId,
      threadId,
      direction: "outbound",
      status: "draft",
      composeKind: "new",
      sourceMessageId: null,
      providerMessageId: null,
      providerThreadId: null,
      rfcMessageId: null,
      inReplyTo: null,
      references: [],
      fromAddress: account.address,
      fromName: account.displayName,
      to: JSON.stringify(input.to ?? []),
      cc: "[]",
      bcc: "[]",
      replyTo: "[]",
      subject: input.subject ?? "",
      snippet: null,
      bodyText: null,
      bodyHtml: `<p></p>${signatureBlock(account.signatureHtml)}`,
      headers: "{}",
      rawMediaId: null,
      sentAt: null,
      receivedAt: null,
      scheduledAt: null,
      sendAfter: null,
      nextAttemptAt: null,
      lastError: null,
      isRead: true,
      sentByUserId: userId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedByUserId: null,
      purgedAt: null,
    })
    .execute();
  await recomputeThread(threadId);
  return id;
}

async function requireDraft(organizationId: string, userId: string, draftId: string) {
  const draft = await requireMessage(organizationId, userId, draftId, "member");
  if (draft.status !== "draft") throw new EmailAccessError(409, "not_a_draft");
  if (draft.sentByUserId && draft.sentByUserId !== userId) throw new EmailAccessError(403, "forbidden");
  return draft;
}

function cleanAddresses(value: unknown): EmailAddress[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? { name: null, address: v } : (v as EmailAddress)))
    .filter((v) => v && typeof v.address === "string")
    .map((v) => ({ name: v.name?.trim() || null, address: v.address.trim().toLowerCase() }))
    .filter((v) => v.address);
}

export async function updateDraft(
  organizationId: string,
  userId: string,
  draftId: string,
  patch: { to?: unknown; cc?: unknown; bcc?: unknown; subject?: unknown; bodyHtml?: unknown; fromAddress?: unknown; accountId?: unknown; includeQuote?: unknown; ifUpdatedAt?: unknown },
) {
  const draft = await requireDraft(organizationId, userId, draftId);
  if (typeof patch.ifUpdatedAt === "string" && new Date(patch.ifUpdatedAt).getTime() !== draft.updatedAt.getTime()) {
    throw new EmailAccessError(409, "draft_conflict");
  }
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.to !== undefined) values.to = JSON.stringify(cleanAddresses(patch.to));
  if (patch.cc !== undefined) values.cc = JSON.stringify(cleanAddresses(patch.cc));
  if (patch.bcc !== undefined) values.bcc = JSON.stringify(cleanAddresses(patch.bcc));
  if (typeof patch.subject === "string") values.subject = patch.subject.slice(0, 998);
  if (typeof patch.bodyHtml === "string") {
    values.bodyHtml = patch.bodyHtml;
    values.bodyText = htmlToText(patch.bodyHtml);
    values.snippet = makeSnippet(values.bodyText as string);
  }
  if (typeof patch.includeQuote === "boolean") values.headers = JSON.stringify({ ...draft.headers, "x-twodb-include-quote": patch.includeQuote ? "1" : "0" });

  let accountId = draft.accountId;
  if (typeof patch.accountId === "string" && patch.accountId !== draft.accountId) {
    if (draft.composeKind !== "new") throw new EmailAccessError(400, "cannot_change_account_on_reply");
    await requireAccountRole(organizationId, userId, patch.accountId, "member");
    accountId = patch.accountId;
    const account = await loadAccount(accountId);
    values.accountId = accountId;
    values.fromAddress = account.address;
    values.fromName = account.displayName;
    await db.updateTable("email_thread").set({ accountId }).where("id", "=", draft.threadId).execute();
  }
  if (typeof patch.fromAddress === "string") {
    const account = await loadAccount(accountId);
    const from = patch.fromAddress.toLowerCase();
    if (!ownAddresses(account).has(from)) throw new EmailAccessError(400, "from_not_allowed");
    values.fromAddress = from;
  }
  await db.updateTable("email_message").set(values).where("id", "=", draft.id).execute();
  if (draft.composeKind === "new" && typeof patch.subject === "string") {
    await db.updateTable("email_thread").set({ subject: normalizeSubject(patch.subject) }).where("id", "=", draft.threadId).execute();
  }
  await recomputeThread(draft.threadId);
  const row = await db.selectFrom("email_message").select("updatedAt").where("id", "=", draft.id).executeTakeFirstOrThrow();
  return { updatedAt: row.updatedAt.toISOString() };
}

export async function addDraftAttachment(organizationId: string, userId: string, draftId: string, file: { filename: string; contentType: string | null; data: Buffer; inline?: boolean }) {
  const draft = await requireDraft(organizationId, userId, draftId);
  const mediaId = await storeEmailBytes({ organizationId, accountId: draft.accountId, filename: file.filename, contentType: file.contentType, data: file.data });
  const id = crypto.randomUUID();
  const contentId = file.inline ? `${id}@twodb` : null;
  await db
    .insertInto("email_attachment")
    .values({
      id,
      organizationId,
      messageId: draft.id,
      mediaId,
      filename: file.filename,
      contentType: file.contentType,
      size: file.data.length,
      contentId,
      isInline: !!file.inline,
      status: "stored",
      createdAt: new Date(),
    })
    .execute();
  await db.updateTable("email_message").set({ updatedAt: new Date() }).where("id", "=", draft.id).execute();
  await recomputeThread(draft.threadId);
  return { id, contentId, url: `/api/email/attachments/${id}` };
}

export async function removeDraftAttachment(organizationId: string, userId: string, draftId: string, attachmentId: string) {
  const draft = await requireDraft(organizationId, userId, draftId);
  const att = await db.selectFrom("email_attachment").selectAll().where("id", "=", attachmentId).where("messageId", "=", draft.id).executeTakeFirst();
  if (!att) throw new EmailAccessError(404, "attachment_not_found");
  await db.deleteFrom("email_attachment").where("id", "=", att.id).execute();
  await releaseEmailMedia([att.mediaId]);
  await recomputeThread(draft.threadId);
}

export async function discardDraft(organizationId: string, userId: string, draftId: string) {
  const draft = await requireDraft(organizationId, userId, draftId);
  await hardDeleteMessage(draft.id);
  await recomputeThread(draft.threadId);
  return draft;
}

/** Validates, assigns the Message-ID and queues (with undo window) or schedules. The outbox does the rest. */
export async function sendDraft(organizationId: string, userId: string, draftId: string, opts: { scheduledAt?: string | null; undoSeconds?: number }) {
  const draft = await requireDraft(organizationId, userId, draftId);
  const recipients = [...draft.to, ...draft.cc, ...draft.bcc];
  if (!recipients.length) throw new EmailAccessError(400, "recipients_required");
  const invalid = recipients.find((r) => !ADDRESS_RE.test(r.address));
  if (invalid) throw new EmailAccessError(400, `invalid_recipient: ${invalid.address}`);
  const atts = await db.selectFrom("email_attachment").select(["status", "size"]).where("messageId", "=", draft.id).execute();
  if (atts.some((a) => a.status !== "stored")) throw new EmailAccessError(400, "attachments_not_ready");
  if (atts.reduce((s, a) => s + a.size, 0) > MAX_TOTAL_BYTES) throw new EmailAccessError(400, "attachments_too_large");
  const account = await loadAccount(draft.accountId);
  if (account.status === "reauth_required") throw new EmailAccessError(409, "account_reauth_required");

  const now = new Date();
  const scheduledAt = opts.scheduledAt ? new Date(opts.scheduledAt) : null;
  if (scheduledAt && (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= now)) throw new EmailAccessError(400, "invalid_schedule_time");
  const domain = (draft.fromAddress ?? account.address).split("@")[1] ?? "twodb.local";
  const undo = Math.max(0, Math.min(opts.undoSeconds ?? UNDO_SECONDS, 60));
  await db
    .updateTable("email_message")
    .set({
      status: scheduledAt ? "scheduled" : "queued",
      scheduledAt,
      sendAfter: scheduledAt ?? new Date(now.getTime() + undo * 1000),
      rfcMessageId: draft.rfcMessageId ?? `<${crypto.randomUUID()}@${domain}>`.toLowerCase(),
      subject: draft.subject.trim() || "(no subject)",
      attempts: 0,
      nextAttemptAt: null,
      lastError: null,
      updatedAt: now,
    })
    .where("id", "=", draft.id)
    .where("status", "=", "draft")
    .execute();
  await recomputeThread(draft.threadId);
  return draft;
}

/** Undo send / unschedule / edit a failed message — back to draft. */
export async function cancelSend(organizationId: string, userId: string, messageId: string) {
  const message = await requireMessage(organizationId, userId, messageId, "member");
  const res = await db
    .updateTable("email_message")
    .set({ status: "draft", scheduledAt: null, sendAfter: null, nextAttemptAt: null, updatedAt: new Date() })
    .where("id", "=", message.id)
    .where("status", "in", ["queued", "scheduled", "failed"])
    .executeTakeFirst();
  if (!res.numUpdatedRows) throw new EmailAccessError(409, "already_sending");
  await recomputeThread(message.threadId);
  return message;
}

export async function retrySend(organizationId: string, userId: string, messageId: string) {
  const message = await requireMessage(organizationId, userId, messageId, "member");
  const res = await db
    .updateTable("email_message")
    .set({ status: "queued", sendAfter: new Date(), nextAttemptAt: null, attempts: 0, lastError: null, updatedAt: new Date() })
    .where("id", "=", message.id)
    .where("status", "=", "failed")
    .executeTakeFirst();
  if (!res.numUpdatedRows) throw new EmailAccessError(409, "not_failed");
  await recomputeThread(message.threadId);
  return message;
}

