import { db } from "../../auth";
import { logger } from "../logger";
import { addDraftAttachment, createDraft, sendDraft, updateDraft } from "../email/compose";
import type { EmailAccountRow } from "../email/types";
import { ensureDefaultCalendar, getSettings } from "./calendars";
import { createEvent, replaceAttendees, respondToEvent, setInviteHook } from "./events";
import { parseIcs, serializeIcs, type SerializableEvent } from "./ical";
import { rebuildOccurrences } from "./occurrences";
import { loadAttendees } from "./snapshot";
import { CalendarAccessError, type NormalizedEvent } from "./types";

// Invitations by email (iMIP, RFC 6047). Incoming text/calendar parts become
// invitations (an RSVP card in the reader, plus a tentative event in a twodb
// calendar when the provider doesn't already handle invites); twodb
// calendars with outside guests send REQUEST / CANCEL / REPLY through the
// user's email account.

function eventTime(e: NormalizedEvent) {
  return e.isAllDay ? (e.startDate ? new Date(`${e.startDate}T00:00:00Z`) : null) : (e.startAt ?? null);
}

/** Calendar events with this UID that the account's user can see (provider calendars of the account + their twodb calendars). */
async function findByUid(account: EmailAccountRow, uid: string) {
  return db
    .selectFrom("calendar_event")
    .innerJoin("calendar", "calendar.id", "calendar_event.calendarId")
    .selectAll("calendar_event")
    .where("calendar_event.uid", "=", uid)
    .where("calendar_event.recurringEventId", "is", null)
    .where("calendar.organizationId", "=", account.organizationId)
    .where((eb) =>
      eb.or([eb("calendar.accountId", "=", account.id), eb.and([eb("calendar.accountId", "is", null), eb("calendar.ownerUserId", "=", account.ownerUserId)])]),
    )
    .orderBy("calendar_event.createdAt")
    .executeTakeFirst();
}

async function createFromInvite(account: EmailAccountRow, ne: NormalizedEvent): Promise<string> {
  const settings = await getSettings(account.organizationId, account.ownerUserId);
  const target = settings.defaultCalendarId
    ? await db.selectFrom("calendar").select(["id", "accountId"]).where("id", "=", settings.defaultCalendarId).where("deletedAt", "is", null).executeTakeFirst()
    : null;
  const calendarId = target && !target.accountId ? target.id : await ensureDefaultCalendar(account.organizationId, account.ownerUserId);
  const id = crypto.randomUUID();
  const now = new Date();
  await db
    .insertInto("calendar_event")
    .values({
      id,
      organizationId: account.organizationId,
      calendarId,
      uid: ne.uid,
      providerEventId: null,
      etag: null,
      sequence: ne.sequence ?? 0,
      recurringEventId: null,
      originalStartAt: null,
      rrule: ne.rrule ?? null,
      status: "tentative",
      title: ne.title,
      descriptionHtml: ne.descriptionHtml ?? null,
      location: ne.location ?? null,
      geo: JSON.stringify(null),
      isAllDay: ne.isAllDay,
      startAt: ne.startAt ?? null,
      endAt: ne.endAt ?? null,
      startDate: ne.startDate ?? null,
      endDate: ne.endDate ?? null,
      startTz: ne.startTz ?? null,
      endTz: ne.endTz ?? null,
      transparency: ne.transparency ?? "opaque",
      color: null,
      organizer: JSON.stringify(ne.organizer ?? null),
      conference: JSON.stringify(ne.conference ?? null),
      eventTypeProps: "{}",
      meetingRecordingId: null,
      source: "imip",
      rawIcs: null,
      providerData: JSON.stringify({ imipAccountId: account.id }),
      providerUpdatedAt: null,
      localOnlyFields: "{}",
      localDeletedAt: null,
      createdByUserId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedSource: null,
    })
    .execute();
  const self = new Set([account.address, ...account.aliases].map((a) => a.toLowerCase()));
  await replaceAttendees(
    id,
    ne.attendees.map((a) => ({ ...a, isSelf: self.has(a.email) })),
  );
  await rebuildOccurrences(id);
  return id;
}

export async function processImip(account: EmailAccountRow, emailMessageId: string, icsText: string, opts: { backfill: boolean }) {
  const parsed = parseIcs(icsText);
  const method = parsed.method ?? "PUBLISH";
  const ne = parsed.events.find((e) => !e.recurringProviderEventId) ?? parsed.events[0];
  if (!ne) return;
  const already = await db
    .selectFrom("calendar_imip_message")
    .select("id")
    .where("emailMessageId", "=", emailMessageId)
    .where("uid", "=", ne.uid)
    .executeTakeFirst();
  if (already) return;
  const existing = await findByUid(account, ne.uid);
  let eventId: string | null = existing?.id ?? null;
  let result = "linked";
  const start = eventTime(ne);
  const past = start ? start.getTime() < Date.now() - 86_400_000 && !ne.rrule : false;

  if (method === "REQUEST" && !existing) {
    // Google/Microsoft calendars receive invites themselves; the import links them by UID.
    const providerHandles = account.capabilities.includes("calendar") && account.kind !== "imap";
    const settings = await getSettings(account.organizationId, account.ownerUserId);
    if (!providerHandles && !past && !opts.backfill && settings.autoAddInvites === "always") {
      eventId = await createFromInvite(account, ne);
      result = "created";
    } else result = providerHandles ? "provider" : "card_only";
  } else if (method === "REQUEST" && existing && existing.source === "imip" && (ne.sequence ?? 0) >= existing.sequence) {
    await db
      .updateTable("calendar_event")
      .set({
        title: ne.title,
        location: ne.location ?? null,
        descriptionHtml: ne.descriptionHtml ?? null,
        isAllDay: ne.isAllDay,
        startAt: ne.startAt ?? null,
        endAt: ne.endAt ?? null,
        startDate: ne.startDate ?? null,
        endDate: ne.endDate ?? null,
        startTz: ne.startTz ?? null,
        endTz: ne.endTz ?? null,
        rrule: ne.rrule ?? null,
        sequence: ne.sequence ?? 0,
        updatedAt: new Date(),
      })
      .where("id", "=", existing.id)
      .execute();
    await rebuildOccurrences(existing.id);
    result = "updated";
  } else if (method === "CANCEL" && existing && existing.source === "imip") {
    await db
      .updateTable("calendar_event")
      .set({ status: "cancelled", deletedAt: new Date(), deletedSource: "provider", updatedAt: new Date() })
      .where("id", "=", existing.id)
      .execute();
    await rebuildOccurrences(existing.id);
    result = "cancelled";
  } else if (method === "REPLY" && existing) {
    const calendar = await db.selectFrom("calendar").select("accountId").where("id", "=", existing.calendarId).executeTakeFirst();
    if (calendar && !calendar.accountId) {
      for (const a of ne.attendees) {
        await db
          .updateTable("calendar_event_attendee")
          .set({ status: a.status ?? "needs_action", comment: a.comment ?? null, respondedAt: new Date() })
          .where("eventId", "=", existing.id)
          .where("email", "=", a.email)
          .execute();
      }
      result = "reply_applied";
    }
  }
  await db
    .insertInto("calendar_imip_message")
    .values({
      id: crypto.randomUUID(),
      organizationId: account.organizationId,
      emailMessageId,
      method,
      uid: ne.uid,
      sequence: ne.sequence ?? 0,
      eventId,
      result,
      processedAt: new Date(),
    })
    .onConflict((oc) => oc.columns(["emailMessageId", "uid"]).doNothing())
    .execute();
}

export async function processImipSafely(account: EmailAccountRow, emailMessageId: string, icsText: string, opts: { backfill: boolean }) {
  try {
    await processImip(account, emailMessageId, icsText, opts);
  } catch (e) {
    logger.warn({ err: e, emailMessageId }, "calendar: imip processing failed");
  }
}

/** Invitation card data for the email reader. */
export async function inviteForMessage(organizationId: string, emailMessageId: string) {
  const row = await db
    .selectFrom("calendar_imip_message")
    .selectAll()
    .where("emailMessageId", "=", emailMessageId)
    .where("organizationId", "=", organizationId)
    .executeTakeFirst();
  if (!row) return null;
  const attachment = await db
    .selectFrom("email_attachment")
    .select(["mediaId"])
    .where("messageId", "=", emailMessageId)
    .where((eb) => eb.or([eb("contentType", "like", "text/calendar%"), eb("filename", "ilike", "%.ics")]))
    .executeTakeFirst();
  let summary: NormalizedEvent | null = null;
  if (attachment?.mediaId) {
    const { readEmailMedia } = await import("../email/storage");
    const media = await readEmailMedia(organizationId, attachment.mediaId).catch(() => null);
    if (media) summary = parseIcs(media.body.toString("utf8")).events[0] ?? null;
  }
  const event = row.eventId
    ? await db.selectFrom("calendar_event").select(["id", "calendarId", "status", "deletedAt"]).where("id", "=", row.eventId).executeTakeFirst()
    : null;
  const self = event
    ? await db
        .selectFrom("calendar_event_attendee")
        .select(["status", "localStatus"])
        .where("eventId", "=", event.id)
        .where("isSelf", "=", true)
        .executeTakeFirst()
    : null;
  return {
    method: row.method,
    result: row.result,
    uid: row.uid,
    eventId: event && !event.deletedAt ? event.id : null,
    calendarId: event?.calendarId ?? null,
    selfStatus: self ? (self.localStatus ?? self.status) : null,
    summary: summary
      ? {
          title: summary.title,
          location: summary.location,
          isAllDay: summary.isAllDay,
          startAt: summary.startAt,
          endAt: summary.endAt,
          startDate: summary.startDate,
          endDate: summary.endDate,
          organizer: summary.organizer,
          attendeeCount: summary.attendees.length,
          recurring: !!summary.rrule,
          conference: summary.conference,
        }
      : null,
  };
}

/** RSVP from the email card: provider-backed events go through Pending push; otherwise an iMIP REPLY is mailed to the organizer. */
export async function respondToInvite(
  organizationId: string,
  userId: string,
  emailMessageId: string,
  status: "accepted" | "declined" | "tentative",
  comment: string | null,
) {
  const row = await db
    .selectFrom("calendar_imip_message")
    .selectAll()
    .where("emailMessageId", "=", emailMessageId)
    .where("organizationId", "=", organizationId)
    .executeTakeFirst();
  if (!row) throw new CalendarAccessError(404, "invite_not_found");
  const message = await db.selectFrom("email_message").select(["accountId"]).where("id", "=", emailMessageId).executeTakeFirstOrThrow();
  const account = await db.selectFrom("connected_account").selectAll().where("id", "=", message.accountId).executeTakeFirstOrThrow();
  let eventId = row.eventId;
  if (!eventId) {
    const found = await findByUid(account, row.uid);
    eventId = found?.id ?? null;
  }
  if (!eventId) {
    const settings = await getSettings(organizationId, userId);
    if (settings.autoAddInvites !== "never") {
      const invite = await inviteForMessage(organizationId, emailMessageId);
      if (invite?.summary) {
        const attachment = await db
          .selectFrom("email_attachment")
          .select("mediaId")
          .where("messageId", "=", emailMessageId)
          .where((eb) => eb.or([eb("contentType", "like", "text/calendar%"), eb("filename", "ilike", "%.ics")]))
          .executeTakeFirst();
        const { readEmailMedia } = await import("../email/storage");
        const media = attachment?.mediaId ? await readEmailMedia(organizationId, attachment.mediaId) : null;
        const ne = media ? parseIcs(media.body.toString("utf8")).events[0] : null;
        if (ne) {
          eventId = await createFromInvite(account, ne);
          await db.updateTable("calendar_imip_message").set({ eventId, result: "created" }).where("id", "=", row.id).execute();
        }
      }
    }
  }
  if (eventId) {
    const event = await db
      .selectFrom("calendar_event")
      .innerJoin("calendar", "calendar.id", "calendar_event.calendarId")
      .select(["calendar.accountId", "calendar_event.organizer"])
      .where("calendar_event.id", "=", eventId)
      .executeTakeFirstOrThrow();
    if (event.accountId) return respondToEvent(organizationId, userId, eventId, status, comment);
    await db
      .updateTable("calendar_event_attendee")
      .set({ status, comment, respondedAt: new Date() })
      .where("eventId", "=", eventId)
      .where("isSelf", "=", true)
      .execute();
    if (status !== "declined")
      await db.updateTable("calendar_event").set({ status: "confirmed" }).where("id", "=", eventId).where("status", "=", "tentative").execute();
    await rebuildOccurrences(eventId);
    await sendInviteMail(eventId, userId, "REPLY", { status, comment, accountId: account.id });
    return;
  }
  throw new CalendarAccessError(409, "invite_event_missing");
}

// ── outgoing ─────────────────────────────────────────────────────────────────

function formatWhen(e: { isAllDay: boolean; startAt: Date | null; startDate: string | null; startTz: string | null }) {
  if (e.isAllDay) return e.startDate ?? "";
  return e.startAt
    ? e.startAt.toLocaleString("en-US", { timeZone: e.startTz ?? "UTC", dateStyle: "medium", timeStyle: "short" }) + ` (${e.startTz ?? "UTC"})`
    : "";
}

function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function senderAccount(userId: string, organizationId: string, preferred?: string | null) {
  if (preferred) {
    const a = await db.selectFrom("connected_account").select(["id", "address"]).where("id", "=", preferred).where("deletedAt", "is", null).executeTakeFirst();
    if (a) return a;
  }
  return db
    .selectFrom("connected_account")
    .innerJoin("connected_account_member", "connected_account_member.accountId", "connected_account.id")
    .select(["connected_account.id", "connected_account.address"])
    .where("connected_account_member.userId", "=", userId)
    .where("connected_account_member.role", "in", ["owner", "member"])
    .where("connected_account.organizationId", "=", organizationId)
    .where("connected_account.deletedAt", "is", null)
    .where((eb) => eb(eb.val("mail"), "=", eb.fn.any("connected_account.capabilities")))
    .orderBy("connected_account.createdAt")
    .executeTakeFirst();
}

/** Mails REQUEST / CANCEL / REPLY for a twodb-calendar event through the user's email account. */
export async function sendInviteMail(eventId: string, userId: string, method: "REQUEST" | "CANCEL" | "REPLY", extra: Record<string, unknown> = {}) {
  const event = await db.selectFrom("calendar_event").selectAll().where("id", "=", eventId).executeTakeFirst();
  if (!event) return;
  const master = event.recurringEventId ? await db.selectFrom("calendar_event").selectAll().where("id", "=", event.recurringEventId).executeTakeFirst() : null;
  const attendees = await loadAttendees(event.id);
  const account = await senderAccount(
    userId,
    event.organizationId,
    (extra.accountId as string | undefined) ?? (event.providerData?.imipAccountId as string | undefined),
  );
  if (!account) {
    logger.info({ eventId }, "calendar: no mail account to send invitations from");
    return;
  }
  const self = new Set([account.address.toLowerCase()]);
  const sequence = method === "REPLY" ? event.sequence : event.sequence + 1;
  if (method !== "REPLY") await db.updateTable("calendar_event").set({ sequence }).where("id", "=", event.id).execute();
  const organizer = event.organizer ?? { email: account.address };
  const recipients =
    method === "REPLY"
      ? [{ name: organizer.name ?? null, address: organizer.email }]
      : attendees.filter((a) => !self.has(a.email.toLowerCase()) && a.role !== "resource").map((a) => ({ name: a.name ?? null, address: a.email }));
  if (!recipients.length) return;
  const replyAttendees =
    method === "REPLY"
      ? attendees
          .filter((a) => self.has(a.email.toLowerCase()))
          .map((a) => ({ ...a, status: String(extra.status ?? a.status), comment: (extra.comment as string | null) ?? null }))
      : attendees;
  const ics: SerializableEvent = {
    ...event,
    uid: event.uid,
    sequence,
    status: method === "CANCEL" ? "cancelled" : "confirmed",
    rrule: event.recurringEventId ? null : event.rrule,
    originalStartAt: master ? event.originalStartAt : null,
    organizer,
    attendees: replyAttendees,
    reminders: null,
  };
  const verb =
    method === "REQUEST"
      ? event.sequence > 0
        ? "Updated invitation"
        : "Invitation"
      : method === "CANCEL"
        ? "Cancelled"
        : extra.status === "accepted"
          ? "Accepted"
          : extra.status === "declined"
            ? "Declined"
            : "Tentative";
  const subject = `${verb}: ${event.title || "(no title)"} @ ${formatWhen(event)}`;
  const body = [
    `<p><strong>${escape(event.title || "(no title)")}</strong></p>`,
    `<p>${escape(formatWhen(event))}${event.location ? `<br>${escape(event.location)}` : ""}</p>`,
    event.conference?.url ? `<p><a href="${escape(event.conference.url)}">Join video call</a></p>` : "",
    method === "REPLY"
      ? `<p>${escape(String(extra.status ?? ""))}${extra.comment ? ` — ${escape(String(extra.comment))}` : ""}</p>`
      : (event.descriptionHtml ?? ""),
  ].join("");

  const owner = await db.selectFrom("connected_account").select(["organizationId", "ownerUserId"]).where("id", "=", account.id).executeTakeFirstOrThrow();
  const actingUser = userId || owner.ownerUserId;
  const draftId = await createDraft(owner.organizationId, actingUser, { accountId: account.id, to: recipients, subject });
  await updateDraft(owner.organizationId, actingUser, draftId, { bodyHtml: body });
  const headers = await db.selectFrom("email_message").select("headers").where("id", "=", draftId).executeTakeFirstOrThrow();
  await db
    .updateTable("email_message")
    .set({ headers: JSON.stringify({ ...headers.headers, "x-twodb-ical-method": method }) })
    .where("id", "=", draftId)
    .execute();
  await addDraftAttachment(owner.organizationId, actingUser, draftId, {
    filename: "invite.ics",
    contentType: `text/calendar; charset=utf-8; method=${method}`,
    data: Buffer.from(serializeIcs([ics], { method })),
  });
  await sendDraft(owner.organizationId, actingUser, draftId, { undoSeconds: 0 });
}

setInviteHook(async (eventId, userId, method, extra) => {
  try {
    await sendInviteMail(eventId, userId, method, extra);
  } catch (e) {
    logger.warn({ err: e, eventId, method }, "calendar: sending invitation failed");
  }
});

export { createEvent };
