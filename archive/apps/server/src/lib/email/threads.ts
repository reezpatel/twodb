import { sql, type ExpressionBuilder, type Selectable, type Updateable } from "kysely";
import { db } from "../../auth";
import type { Database, EmailAddress, EmailMessageTable, EmailThreadTable } from "../../plugins/db";
import { accessibleAccounts, EmailAccessError, requireThread, type EmailRole } from "./access";
import { applyLabels, labelSubtreeIds, visibleLabelIds } from "./labels";
import { releaseEmailMedia } from "./storage";

export const EMAIL_VIEWS = ["inbox", "starred", "sent", "drafts", "scheduled", "outbox", "snoozed", "archive", "spam", "trash", "all"] as const;
export type EmailView = (typeof EMAIL_VIEWS)[number];

type ThreadRow = Selectable<EmailThreadTable>;
type MessageRow = Selectable<EmailMessageTable>;

const OUTBOX_STATUSES = ["queued", "sending", "failed"];

/** Recomputes every denormalized thread column from its messages. Deletes threads left with no messages at all. */
export async function recomputeThread(threadId: string): Promise<ThreadRow | null> {
  const thread = await db.selectFrom("email_thread").selectAll().where("id", "=", threadId).executeTakeFirst();
  if (!thread) return null;
  const messages = await db
    .selectFrom("email_message")
    .select(["id", "direction", "status", "isRead", "isStarred", "sentAt", "receivedAt", "updatedAt", "fromAddress", "fromName", "to", "cc", "snippet", "subject", "deletedAt", "purgedAt"])
    .where("threadId", "=", threadId)
    .execute();
  if (!messages.length) {
    await db.deleteFrom("email_thread").where("id", "=", threadId).execute();
    return null;
  }
  const live = messages.filter((m) => !m.deletedAt && !m.purgedAt);
  const nonDraft = live.filter((m) => m.status !== "draft");
  const attachmentRows = live.length
    ? await db
        .selectFrom("email_attachment")
        .select("messageId")
        .where("messageId", "in", live.map((m) => m.id))
        .where("isInline", "=", false)
        .limit(1)
        .execute()
    : [];
  const when = (m: (typeof messages)[number]) => (m.sentAt ?? m.receivedAt ?? m.updatedAt).getTime();
  const sorted = [...live].sort((a, b) => when(a) - when(b));
  const latest = sorted.at(-1);
  const inbound = live.filter((m) => m.direction === "inbound");

  const participants = new Map<string, EmailAddress>();
  for (const m of nonDraft) {
    if (m.fromAddress) participants.set(m.fromAddress, { name: m.fromName, address: m.fromAddress });
    for (const r of [...m.to, ...m.cc]) if (!participants.has(r.address)) participants.set(r.address, r);
  }
  const allPurged = messages.every((m) => m.purgedAt);
  const now = new Date();
  const next = {
    messageCount: nonDraft.length,
    unreadCount: inbound.filter((m) => !m.isRead).length,
    hasAttachments: attachmentRows.length > 0,
    hasStarred: live.some((m) => m.isStarred),
    hasDraft: live.some((m) => m.status === "draft"),
    hasSent: live.some((m) => m.direction === "outbound" && m.status === "sent"),
    hasOutbox: live.some((m) => OUTBOX_STATUSES.includes(m.status)),
    hasScheduled: live.some((m) => m.status === "scheduled"),
    hasDeletedMessages: messages.some((m) => m.deletedAt && !m.purgedAt),
    lastMessageAt: latest ? new Date(when(latest)) : thread.lastMessageAt,
    lastInboundAt: inbound.length ? new Date(Math.max(...inbound.map(when))) : null,
    participants: JSON.stringify([...participants.values()].slice(0, 12)),
    snippet: latest?.snippet ?? thread.snippet,
    deletedAt: !live.length && !thread.deletedAt && !allPurged ? now : thread.deletedAt,
    purgedAt: allPurged ? (thread.purgedAt ?? now) : null,
    updatedAt: now,
  };
  await db.updateTable("email_thread").set(next).where("id", "=", threadId).execute();
  return (await db.selectFrom("email_thread").selectAll().where("id", "=", threadId).executeTakeFirst()) ?? null;
}

function viewFilter(view: EmailView) {
  return (eb: ExpressionBuilder<Database, "email_thread">) => {
    const live = eb("email_thread.deletedAt", "is", null);
    const notSpam = eb("email_thread.location", "!=", "spam");
    const awake = eb.or([eb("email_thread.snoozedUntil", "is", null), eb("email_thread.snoozedUntil", "<=", new Date())]);
    switch (view) {
      case "inbox":
        return eb.and([live, eb("email_thread.location", "=", "inbox"), awake, eb("email_thread.messageCount", ">", 0)]);
      case "starred":
        return eb.and([live, notSpam, eb("email_thread.hasStarred", "=", true)]);
      case "sent":
        return eb.and([live, eb("email_thread.hasSent", "=", true)]);
      case "drafts":
        return eb.and([live, eb("email_thread.hasDraft", "=", true)]);
      case "scheduled":
        return eb.and([live, eb("email_thread.hasScheduled", "=", true)]);
      case "outbox":
        return eb.and([live, eb("email_thread.hasOutbox", "=", true)]);
      case "snoozed":
        return eb.and([live, eb("email_thread.snoozedUntil", ">", new Date())]);
      case "archive":
        return eb.and([live, eb("email_thread.location", "=", "archive"), eb("email_thread.messageCount", ">", 0)]);
      case "spam":
        return eb.and([live, eb("email_thread.location", "=", "spam")]);
      case "trash":
        return eb.or([eb("email_thread.deletedAt", "is not", null), eb("email_thread.hasDeletedMessages", "=", true)]);
      case "all":
        return eb.and([live, notSpam, eb("email_thread.messageCount", ">", 0)]);
    }
  };
}

export interface ThreadPayload {
  id: string;
  accountId: string;
  subject: string;
  snippet: string | null;
  participants: EmailAddress[];
  lastMessageAt: string;
  messageCount: number;
  unreadCount: number;
  location: string;
  isPinned: boolean;
  snoozedUntil: string | null;
  muted: boolean;
  hasAttachments: boolean;
  hasStarred: boolean;
  hasDraft: boolean;
  hasSent: boolean;
  hasOutbox: boolean;
  hasScheduled: boolean;
  hasDeletedMessages: boolean;
  deletedAt: string | null;
  labelIds: string[];
}

async function serializeThreads(organizationId: string, userId: string, rows: ThreadRow[]): Promise<ThreadPayload[]> {
  if (!rows.length) return [];
  const visible = await visibleLabelIds(organizationId, userId);
  const links = await db.selectFrom("email_thread_label").select(["threadId", "labelId"]).where("threadId", "in", rows.map((r) => r.id)).execute();
  const labelsByThread = new Map<string, string[]>();
  for (const l of links) {
    if (!visible.has(l.labelId)) continue;
    labelsByThread.set(l.threadId, [...(labelsByThread.get(l.threadId) ?? []), l.labelId]);
  }
  return rows.map((t) => ({
    id: t.id,
    accountId: t.accountId,
    subject: t.subject,
    snippet: t.snippet,
    participants: t.participants,
    lastMessageAt: t.lastMessageAt.toISOString(),
    messageCount: t.messageCount,
    unreadCount: t.unreadCount,
    location: t.location,
    isPinned: t.isPinned,
    snoozedUntil: t.snoozedUntil?.toISOString() ?? null,
    muted: !!t.mutedAt,
    hasAttachments: t.hasAttachments,
    hasStarred: t.hasStarred,
    hasDraft: t.hasDraft,
    hasSent: t.hasSent,
    hasOutbox: t.hasOutbox,
    hasScheduled: t.hasScheduled,
    hasDeletedMessages: t.hasDeletedMessages,
    deletedAt: t.deletedAt?.toISOString() ?? null,
    labelIds: labelsByThread.get(t.id) ?? [],
  }));
}

function encodeCursor(row: ThreadRow) {
  return Buffer.from(`${row.lastMessageAt.toISOString()}|${row.id}`).toString("base64url");
}

function decodeCursor(cursor: string | undefined): { at: Date; id: string } | null {
  if (!cursor) return null;
  const [at, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const date = at ? new Date(at) : null;
  return date && id && !Number.isNaN(date.getTime()) ? { at: date, id } : null;
}

export async function listThreads(input: {
  organizationId: string;
  userId: string;
  view: EmailView;
  accountId?: string | null;
  labelId?: string | null;
  includeChildren?: boolean;
  q?: string | null;
  cursor?: string;
  limit?: number;
}): Promise<{ pinned: ThreadPayload[]; threads: ThreadPayload[]; next: string | null }> {
  const roles = await accessibleAccounts(input.organizationId, input.userId);
  let accountIds = [...roles.keys()];
  if (input.accountId) accountIds = accountIds.filter((id) => id === input.accountId);
  if (!accountIds.length) return { pinned: [], threads: [], next: null };
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const labelIds = input.labelId ? await labelSubtreeIds(input.organizationId, input.userId, input.labelId, input.includeChildren ?? true) : null;
  const q = input.q?.trim();

  const base = () => {
    let query = db
      .selectFrom("email_thread")
      .selectAll("email_thread")
      .where("email_thread.accountId", "in", accountIds)
      .where("email_thread.purgedAt", "is", null);
    if (labelIds) {
      query = query
        .where((eb) => eb.exists(eb.selectFrom("email_thread_label").select("email_thread_label.threadId").whereRef("email_thread_label.threadId", "=", "email_thread.id").where("email_thread_label.labelId", "in", labelIds)))
        .where("email_thread.deletedAt", "is", null)
        .where("email_thread.location", "!=", "spam");
    } else {
      query = query.where(viewFilter(input.view));
    }
    if (q) {
      query = query.where((eb) =>
        eb.exists(
          eb
            .selectFrom("email_message")
            .select("email_message.id")
            .whereRef("email_message.threadId", "=", "email_thread.id")
            .where("email_message.purgedAt", "is", null)
            .where(sql<boolean>`"email_message"."searchVector" @@ websearch_to_tsquery('simple', ${q})`),
        ),
      );
      if (input.view !== "spam" && input.view !== "trash" && !labelIds) query = query.where("email_thread.location", "!=", "spam");
    }
    return query;
  };

  const separatePinned = input.view === "inbox" && !labelIds && !q;
  const pinnedRows = separatePinned && !input.cursor ? await base().where("email_thread.isPinned", "=", true).orderBy("email_thread.lastMessageAt", "desc").limit(50).execute() : [];

  let main = base();
  if (separatePinned) main = main.where("email_thread.isPinned", "=", false);
  const cursor = decodeCursor(input.cursor);
  if (cursor) main = main.where(sql<boolean>`("email_thread"."lastMessageAt", "email_thread"."id") < (${cursor.at}, ${cursor.id})`);
  const rows = await main.orderBy("email_thread.lastMessageAt", "desc").orderBy("email_thread.id", "desc").limit(limit + 1).execute();
  const page = rows.slice(0, limit);
  return {
    pinned: await serializeThreads(input.organizationId, input.userId, pinnedRows),
    threads: await serializeThreads(input.organizationId, input.userId, page),
    next: rows.length > limit && page.length ? encodeCursor(page[page.length - 1]) : null,
  };
}

export async function viewCounts(organizationId: string, userId: string, accountId?: string | null) {
  let accountIds = await accessibleAccounts(organizationId, userId).then((m) => [...m.keys()]);
  if (accountId) accountIds = accountIds.filter((id) => id === accountId);
  const empty = { inbox: 0, inboxTotal: 0, starred: 0, drafts: 0, scheduled: 0, outbox: 0, failed: 0, snoozed: 0, spam: 0, trash: 0 };
  if (!accountIds.length) return empty;
  const row = await sql<typeof empty>`
    select
      count(*) filter (where location = 'inbox' and "deletedAt" is null and "unreadCount" > 0 and "messageCount" > 0 and ("snoozedUntil" is null or "snoozedUntil" <= now()))::int as inbox,
      count(*) filter (where location = 'inbox' and "deletedAt" is null and "messageCount" > 0 and ("snoozedUntil" is null or "snoozedUntil" <= now()))::int as "inboxTotal",
      count(*) filter (where "hasStarred" and "deletedAt" is null and location != 'spam')::int as starred,
      count(*) filter (where "hasDraft" and "deletedAt" is null)::int as drafts,
      count(*) filter (where "hasScheduled" and "deletedAt" is null)::int as scheduled,
      count(*) filter (where "hasOutbox" and "deletedAt" is null)::int as outbox,
      0 as failed,
      count(*) filter (where "snoozedUntil" > now() and "deletedAt" is null)::int as snoozed,
      count(*) filter (where location = 'spam' and "deletedAt" is null and "unreadCount" > 0)::int as spam,
      count(*) filter (where "deletedAt" is not null or "hasDeletedMessages")::int as trash
    from email_thread
    where "accountId" in (${sql.join(accountIds)}) and "purgedAt" is null`.execute(db);
  const failed = await db
    .selectFrom("email_message")
    .select(sql<number>`count(*)::int`.as("n"))
    .where("accountId", "in", accountIds)
    .where("status", "=", "failed")
    .where("deletedAt", "is", null)
    .executeTakeFirst();
  return { ...(row.rows[0] ?? empty), failed: failed?.n ?? 0 };
}

export interface MessagePayload {
  id: string;
  threadId: string;
  accountId: string;
  direction: string;
  status: string;
  composeKind: string | null;
  sourceMessageId: string | null;
  rfcMessageId: string | null;
  from: EmailAddress | null;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  replyTo: EmailAddress[];
  subject: string;
  snippet: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  date: string;
  sentAt: string | null;
  receivedAt: string | null;
  scheduledAt: string | null;
  sendAfter: string | null;
  lastError: string | null;
  attempts: number;
  isRead: boolean;
  isStarred: boolean;
  sentByUserId: string | null;
  sentByName: string | null;
  includeQuote: boolean;
  listUnsubscribe: string | null;
  hasRaw: boolean;
  deletedAt: string | null;
  updatedAt: string;
  attachments: AttachmentPayload[];
}

export interface AttachmentPayload {
  id: string;
  filename: string;
  contentType: string | null;
  size: number;
  contentId: string | null;
  isInline: boolean;
  status: string;
  url: string;
}

export async function serializeMessages(rows: MessageRow[]): Promise<MessagePayload[]> {
  if (!rows.length) return [];
  const attachments = await db.selectFrom("email_attachment").selectAll().where("messageId", "in", rows.map((r) => r.id)).orderBy("createdAt").execute();
  const senderIds = [...new Set(rows.map((r) => r.sentByUserId).filter((v): v is string => !!v))];
  const senders = senderIds.length ? await db.selectFrom("user").select(["id", "name"]).where("id", "in", senderIds).execute() : [];
  const senderName = new Map(senders.map((s) => [s.id, s.name]));
  return rows.map((m) => ({
    id: m.id,
    threadId: m.threadId,
    accountId: m.accountId,
    direction: m.direction,
    status: m.status,
    composeKind: m.composeKind,
    sourceMessageId: m.sourceMessageId,
    rfcMessageId: m.rfcMessageId,
    from: m.fromAddress ? { name: m.fromName, address: m.fromAddress } : null,
    to: m.to,
    cc: m.cc,
    bcc: m.bcc,
    replyTo: m.replyTo,
    subject: m.subject,
    snippet: m.snippet,
    bodyHtml: m.bodyHtml,
    bodyText: m.bodyText,
    date: (m.sentAt ?? m.receivedAt ?? m.updatedAt).toISOString(),
    sentAt: m.sentAt?.toISOString() ?? null,
    receivedAt: m.receivedAt?.toISOString() ?? null,
    scheduledAt: m.scheduledAt?.toISOString() ?? null,
    sendAfter: m.sendAfter?.toISOString() ?? null,
    lastError: m.lastError,
    attempts: m.attempts,
    isRead: m.isRead,
    isStarred: m.isStarred,
    sentByUserId: m.sentByUserId,
    sentByName: m.sentByUserId ? (senderName.get(m.sentByUserId) ?? null) : null,
    includeQuote: m.headers["x-twodb-include-quote"] !== "0",
    listUnsubscribe: m.headers["list-unsubscribe"] ?? null,
    hasRaw: !!m.rawMediaId,
    deletedAt: m.deletedAt?.toISOString() ?? null,
    updatedAt: m.updatedAt.toISOString(),
    attachments: attachments
      .filter((a) => a.messageId === m.id)
      .map((a) => ({
        id: a.id,
        filename: a.filename,
        contentType: a.contentType,
        size: a.size,
        contentId: a.contentId,
        isInline: a.isInline,
        status: a.status,
        url: `/api/email/attachments/${a.id}`,
      })),
  }));
}

export async function getThreadDetail(organizationId: string, userId: string, threadId: string) {
  const thread = await requireThread(organizationId, userId, threadId);
  const roles = await accessibleAccounts(organizationId, userId);
  const rows = await db
    .selectFrom("email_message")
    .selectAll()
    .where("threadId", "=", thread.id)
    .where("purgedAt", "is", null)
    .where((eb) => eb.or([eb("status", "!=", "draft"), eb("sentByUserId", "=", userId), eb("sentByUserId", "is", null)]))
    .execute();
  rows.sort((a, b) => (a.sentAt ?? a.receivedAt ?? a.updatedAt).getTime() - (b.sentAt ?? b.receivedAt ?? b.updatedAt).getTime());
  const [payload] = await serializeThreads(organizationId, userId, [thread]);
  return { thread: payload, role: roles.get(thread.accountId) as EmailRole, messages: await serializeMessages(rows) };
}

// ── local actions ──────────────────────────────────────────────────────────

export type ThreadAction =
  | "read"
  | "unread"
  | "star"
  | "unstar"
  | "pin"
  | "unpin"
  | "archive"
  | "inbox"
  | "spam"
  | "not_spam"
  | "trash"
  | "restore"
  | "purge"
  | "snooze"
  | "unsnooze"
  | "mute"
  | "unmute"
  | "label";

export interface ThreadActionPayload {
  snoozedUntil?: string | null;
  add?: string[];
  remove?: string[];
  rule?: "address" | "domain" | null;
  removeRule?: boolean;
}

/** Applies one action to many threads; returns the touched thread ids grouped by account for broadcasting. */
export async function applyThreadAction(
  organizationId: string,
  userId: string,
  threadIds: string[],
  action: ThreadAction,
  payload: ThreadActionPayload = {},
): Promise<Map<string, string[]>> {
  const threads: ThreadRow[] = [];
  for (const id of [...new Set(threadIds)]) threads.push(await requireThread(organizationId, userId, id, "member"));
  const ids = threads.map((t) => t.id);
  const touched = new Map<string, string[]>();
  for (const t of threads) touched.set(t.accountId, [...(touched.get(t.accountId) ?? []), t.id]);
  if (!ids.length) return touched;
  const now = new Date();
  const setThread = (values: Updateable<EmailThreadTable>) => db.updateTable("email_thread").set(values).where("id", "in", ids).execute();

  switch (action) {
    case "read":
    case "unread":
      await db
        .updateTable("email_message")
        .set({ isRead: action === "read", updatedAt: now })
        .where("threadId", "in", ids)
        .where("direction", "=", "inbound")
        .execute();
      break;
    case "star":
      for (const t of threads) {
        const last = await db
          .selectFrom("email_message")
          .select("id")
          .where("threadId", "=", t.id)
          .where("deletedAt", "is", null)
          .where("status", "!=", "draft")
          .orderBy(sql`coalesce("sentAt", "receivedAt", "updatedAt")`, "desc")
          .limit(1)
          .executeTakeFirst();
        if (last) await db.updateTable("email_message").set({ isStarred: true }).where("id", "=", last.id).execute();
      }
      break;
    case "unstar":
      await db.updateTable("email_message").set({ isStarred: false }).where("threadId", "in", ids).execute();
      break;
    case "pin":
    case "unpin":
      await setThread({ isPinned: action === "pin", updatedAt: now });
      break;
    case "archive":
      await setThread({ location: "archive", snoozedUntil: null, updatedAt: now });
      break;
    case "inbox":
      await setThread({ location: "inbox", updatedAt: now });
      break;
    case "spam":
      await setThread({ location: "spam", isPinned: false, snoozedUntil: null, updatedAt: now });
      if (payload.rule) await createSenderRules(organizationId, userId, threads, payload.rule);
      break;
    case "not_spam":
      await setThread({ location: "inbox", updatedAt: now });
      if (payload.removeRule) await removeSenderRulesFor(organizationId, userId, threads);
      break;
    case "trash":
      await discardDraftsIn(ids, userId);
      await setThread({ deletedAt: now, deletedByUserId: userId, updatedAt: now });
      break;
    case "restore":
      await db.updateTable("email_message").set({ deletedAt: null, deletedByUserId: null }).where("threadId", "in", ids).where("purgedAt", "is", null).execute();
      await setThread({ deletedAt: null, deletedByUserId: null, updatedAt: now });
      break;
    case "purge":
      for (const t of threads) await purgeThread(t);
      break;
    case "snooze": {
      const until = payload.snoozedUntil ? new Date(payload.snoozedUntil) : null;
      if (!until || Number.isNaN(until.getTime()) || until <= now) throw new EmailAccessError(400, "invalid_snooze_time");
      await setThread({ snoozedUntil: until, updatedAt: now });
      break;
    }
    case "unsnooze":
      await setThread({ snoozedUntil: null, updatedAt: now });
      break;
    case "mute":
    case "unmute":
      await setThread({ mutedAt: action === "mute" ? now : null, updatedAt: now });
      break;
    case "label":
      await applyLabels(organizationId, userId, threads, payload.add ?? [], payload.remove ?? []);
      break;
  }
  for (const id of ids) await recomputeThread(id);
  return touched;
}

async function discardDraftsIn(threadIds: string[], userId: string) {
  const drafts = await db
    .selectFrom("email_message")
    .select("id")
    .where("threadId", "in", threadIds)
    .where("status", "=", "draft")
    .where((eb) => eb.or([eb("sentByUserId", "=", userId), eb("sentByUserId", "is", null)]))
    .execute();
  for (const d of drafts) await hardDeleteMessage(d.id);
}

/** Drafts never left our system — removed outright, media released. */
export async function hardDeleteMessage(messageId: string) {
  const atts = await db.selectFrom("email_attachment").select("mediaId").where("messageId", "=", messageId).execute();
  const msg = await db.selectFrom("email_message").select("rawMediaId").where("id", "=", messageId).executeTakeFirst();
  await db.deleteFrom("email_message").where("id", "=", messageId).execute();
  await releaseEmailMedia([...atts.map((a) => a.mediaId), msg?.rawMediaId]);
}

/** Wipes content + bytes but keeps tombstone rows so sync never re-imports them. */
export async function purgeMessages(messageIds: string[]) {
  if (!messageIds.length) return;
  const atts = await db.selectFrom("email_attachment").select("mediaId").where("messageId", "in", messageIds).execute();
  const raws = await db.selectFrom("email_message").select("rawMediaId").where("id", "in", messageIds).execute();
  await db.deleteFrom("email_attachment").where("messageId", "in", messageIds).execute();
  const now = new Date();
  await db
    .updateTable("email_message")
    .set({
      purgedAt: now,
      deletedAt: sql`coalesce("deletedAt", ${now})`,
      bodyHtml: null,
      bodyText: null,
      snippet: null,
      subject: "",
      fromName: null,
      to: "[]",
      cc: "[]",
      bcc: "[]",
      replyTo: "[]",
      headers: "{}",
      rawMediaId: null,
      updatedAt: now,
    })
    .where("id", "in", messageIds)
    .execute();
  await releaseEmailMedia([...atts.map((a) => a.mediaId), ...raws.map((r) => r.rawMediaId)]);
}

/** Purges a trashed thread (all messages) or just the deleted messages of a live thread. */
export async function purgeThread(thread: ThreadRow) {
  const drafts = await db.selectFrom("email_message").select("id").where("threadId", "=", thread.id).where("status", "=", "draft").execute();
  for (const d of drafts) await hardDeleteMessage(d.id);
  let q = db.selectFrom("email_message").select("id").where("threadId", "=", thread.id).where("purgedAt", "is", null);
  if (!thread.deletedAt) q = q.where("deletedAt", "is not", null);
  const ids = (await q.execute()).map((r) => r.id);
  await purgeMessages(ids);
  const updated = await recomputeThread(thread.id);
  if (updated?.purgedAt) {
    await db.deleteFrom("email_thread_label").where("threadId", "=", thread.id).execute();
    await db.updateTable("email_thread").set({ subject: "", snippet: null, participants: "[]" }).where("id", "=", thread.id).execute();
  }
}

/** Empty trash / delete all spam for the user's accessible (member+) accounts. */
export async function purgeView(organizationId: string, userId: string, view: "trash" | "spam", accountId?: string | null) {
  const roles = await accessibleAccounts(organizationId, userId);
  let accountIds = [...roles.entries()].filter(([, role]) => role !== "viewer").map(([id]) => id);
  if (accountId) accountIds = accountIds.filter((id) => id === accountId);
  if (!accountIds.length) return new Map<string, string[]>();
  const rows = await db.selectFrom("email_thread").selectAll().where("accountId", "in", accountIds).where("purgedAt", "is", null).where(viewFilter(view)).execute();
  const touched = new Map<string, string[]>();
  for (const t of rows) {
    if (view === "spam") await db.updateTable("email_thread").set({ deletedAt: new Date() }).where("id", "=", t.id).execute();
    await purgeThread(view === "spam" ? { ...t, deletedAt: new Date() } : t);
    touched.set(t.accountId, [...(touched.get(t.accountId) ?? []), t.id]);
  }
  return touched;
}

export async function setMessageFlags(messageId: string, patch: { isRead?: boolean; isStarred?: boolean }) {
  const values: { isRead?: boolean; isStarred?: boolean; updatedAt: Date } = { updatedAt: new Date() };
  if (typeof patch.isRead === "boolean") values.isRead = patch.isRead;
  if (typeof patch.isStarred === "boolean") values.isStarred = patch.isStarred;
  await db.updateTable("email_message").set(values).where("id", "=", messageId).execute();
}

export async function softDeleteMessage(messageId: string, userId: string, deleted: boolean) {
  const now = new Date();
  await db
    .updateTable("email_message")
    .set(deleted ? { deletedAt: now, deletedByUserId: userId, updatedAt: now } : { deletedAt: null, deletedByUserId: null, updatedAt: now })
    .where("id", "=", messageId)
    .execute();
  if (!deleted) {
    const msg = await db.selectFrom("email_message").select("threadId").where("id", "=", messageId).executeTakeFirst();
    if (msg) await db.updateTable("email_thread").set({ deletedAt: null, deletedByUserId: null }).where("id", "=", msg.threadId).execute();
  }
}

// ── sender rules ────────────────────────────────────────────────────────────

async function lastInboundSender(threadId: string): Promise<string | null> {
  const row = await db
    .selectFrom("email_message")
    .select("fromAddress")
    .where("threadId", "=", threadId)
    .where("direction", "=", "inbound")
    .where("fromAddress", "is not", null)
    .orderBy(sql`coalesce("sentAt", "receivedAt")`, "desc")
    .limit(1)
    .executeTakeFirst();
  return row?.fromAddress ?? null;
}

async function createSenderRules(organizationId: string, userId: string, threads: ThreadRow[], matchType: "address" | "domain") {
  for (const t of threads) {
    const sender = await lastInboundSender(t.id);
    if (!sender) continue;
    const value = matchType === "domain" ? sender.split("@")[1] : sender;
    if (!value) continue;
    const exists = await db
      .selectFrom("email_sender_rule")
      .select("id")
      .where("organizationId", "=", organizationId)
      .where("ownerUserId", "=", userId)
      .where("matchType", "=", matchType)
      .where("value", "=", value)
      .where("accountId", "=", t.accountId)
      .executeTakeFirst();
    if (exists) continue;
    await db
      .insertInto("email_sender_rule")
      .values({ id: crypto.randomUUID(), organizationId, ownerUserId: userId, accountId: t.accountId, matchType, value, action: "spam", createdAt: new Date() })
      .execute();
  }
}

async function removeSenderRulesFor(organizationId: string, userId: string, threads: ThreadRow[]) {
  for (const t of threads) {
    const sender = await lastInboundSender(t.id);
    if (!sender) continue;
    await db
      .deleteFrom("email_sender_rule")
      .where("organizationId", "=", organizationId)
      .where((eb) =>
        eb.or([eb.and([eb("matchType", "=", "address"), eb("value", "=", sender)]), eb.and([eb("matchType", "=", "domain"), eb("value", "=", sender.split("@")[1] ?? "")])]),
      )
      .where((eb) => eb.or([eb("accountId", "=", t.accountId), eb("accountId", "is", null)]))
      .execute();
  }
}

/** True when a sender rule routes this address to spam for the account. */
export async function senderIsSpam(accountId: string, address: string | null): Promise<boolean> {
  if (!address) return false;
  const domain = address.split("@")[1] ?? "";
  const hit = await db
    .selectFrom("email_sender_rule")
    .select("id")
    .where((eb) => eb.or([eb("accountId", "=", accountId), eb("accountId", "is", null)]))
    .where((eb) => eb.or([eb.and([eb("matchType", "=", "address"), eb("value", "=", address)]), eb.and([eb("matchType", "=", "domain"), eb("value", "=", domain)])]))
    .where("action", "=", "spam")
    .limit(1)
    .executeTakeFirst();
  return !!hit;
}

/** Snoozes that expired: clear them so the thread resurfaces. */
export async function wakeSnoozed(): Promise<Map<string, string[]>> {
  const rows = await db
    .updateTable("email_thread")
    .set({ snoozedUntil: null, location: "inbox", updatedAt: new Date() })
    .where("snoozedUntil", "<=", new Date())
    .returning(["id", "accountId"])
    .execute();
  const touched = new Map<string, string[]>();
  for (const r of rows) touched.set(r.accountId, [...(touched.get(r.accountId) ?? []), r.id]);
  return touched;
}
