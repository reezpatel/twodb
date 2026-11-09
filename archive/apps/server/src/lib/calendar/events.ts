import { sql } from "kysely";
import { db } from "../../auth";
import type { CalendarReminderSpec, CalendarPerson } from "../../plugins/db";
import { bookIdForCalendar } from "../contacts/books";
import { learnContacts, normalizeEmail, type Interaction } from "../contacts/learn";
import { accessibleCalendars, requireCalendar, requireEvent, roleAtLeast, type CalendarRole } from "./access";
import { ensureWindow, rebuildOccurrences } from "./occurrences";
import { OPEN_STATUSES, queueChange, setPushState, type RecurrenceScope } from "./pending-push";
import { continueFrom, describeRule, hasInstance, truncateBefore } from "./recurrence";
import { buildSnapshot, loadAttendees, loadReminders, snapshotEvent, writeReminders, type EventSnapshot } from "./snapshot";
import { addDays, dateToUtcMidnight, safeTz } from "./tz";
import { CalendarAccessError, type CalendarRow, type EventRow, type NormalizedAttendee } from "./types";

// Local event writes. Every write lands in twodb tables first (the UI renders
// from them immediately); provider calendars also get a Pending push row.

type Notify = (calendarId: string, payload: Record<string, unknown>) => Promise<void>;
let notify: Notify = async () => {};
export function setCalendarNotifier(fn: Notify) {
  notify = fn;
}
type InviteHook = (eventId: string, userId: string, method: "REQUEST" | "CANCEL" | "REPLY", extra?: Record<string, unknown>) => Promise<void>;
let inviteHook: InviteHook = async () => {};
export function setInviteHook(fn: InviteHook) {
  inviteHook = fn;
}

export interface AttendeeInput {
  email: string;
  name?: string | null;
  role?: string;
}

export interface EventInput {
  calendarId?: string;
  title?: string;
  descriptionHtml?: string | null;
  location?: string | null;
  isAllDay?: boolean;
  startAt?: string | null;
  endAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  startTz?: string | null;
  endTz?: string | null;
  rrule?: string[] | null;
  status?: string;
  transparency?: string;
  visibility?: string;
  eventType?: string;
  eventTypeProps?: Record<string, unknown>;
  color?: string | null;
  conference?: { type: "meet" | "teams" | "custom"; url?: string | null; create?: boolean } | null;
  attendees?: AttendeeInput[];
  reminders?: CalendarReminderSpec[] | null;
  guestsCanModify?: boolean;
  guestsCanInviteOthers?: boolean;
  guestsCanSeeOthers?: boolean;
  meetingRecordingId?: string | null;
}

const STATUSES = new Set(["confirmed", "tentative", "cancelled"]);
const EVENT_TYPES = new Set(["default", "out_of_office", "focus_time", "working_location"]);
const VISIBILITIES = new Set(["default", "public", "private", "confidential"]);

async function selfAddresses(calendar: CalendarRow, userId: string): Promise<Set<string>> {
  if (calendar.accountId) {
    const account = await db.selectFrom("connected_account").select(["address", "aliases"]).where("id", "=", calendar.accountId).executeTakeFirst();
    return new Set([account?.address ?? "", ...(account?.aliases ?? [])].filter(Boolean).map((a) => a.toLowerCase()));
  }
  const user = await db.selectFrom("user").select("email").where("id", "=", userId).executeTakeFirst();
  return new Set([user?.email.toLowerCase() ?? ""].filter(Boolean));
}

/** Reminders follow the provider only on the user's own calendars; elsewhere they're personal and local. */
async function remindersAreLocal(calendar: CalendarRow, role: CalendarRole): Promise<boolean> {
  if (!calendar.accountId) return false;
  return role !== "owner";
}

function cleanAttendees(list: AttendeeInput[] | undefined, self: Set<string>): NormalizedAttendee[] {
  const out = new Map<string, NormalizedAttendee>();
  for (const a of list ?? []) {
    const email = normalizeEmail(a.email);
    if (!email || out.has(email)) continue;
    out.set(email, {
      email,
      name: a.name?.trim() || null,
      role: a.role === "optional" || a.role === "resource" ? a.role : "required",
      status: self.has(email) ? "accepted" : "needs_action",
      isSelf: self.has(email),
    });
  }
  return [...out.values()];
}

/** Validates and normalizes time input into event columns. */
function timeColumns(input: EventInput, fallbackTz: string) {
  if (input.isAllDay) {
    const startDate = input.startDate?.slice(0, 10);
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new CalendarAccessError(400, "invalid_start");
    let endDate = input.endDate?.slice(0, 10) ?? addDays(startDate, 1);
    if (endDate <= startDate) endDate = addDays(startDate, 1);
    return { isAllDay: true, startDate, endDate, startAt: null, endAt: null, startTz: null, endTz: null };
  }
  const startAt = input.startAt ? new Date(input.startAt) : null;
  if (!startAt || Number.isNaN(startAt.getTime())) throw new CalendarAccessError(400, "invalid_start");
  let endAt = input.endAt ? new Date(input.endAt) : new Date(startAt.getTime() + 30 * 60_000);
  if (Number.isNaN(endAt.getTime()) || endAt < startAt) endAt = new Date(startAt.getTime() + 30 * 60_000);
  const startTz = safeTz(input.startTz, fallbackTz);
  return { isAllDay: false, startAt, endAt, startDate: null, endDate: null, startTz, endTz: safeTz(input.endTz, startTz) };
}

function scalarColumns(input: EventInput): Record<string, unknown> {
  const cols: Record<string, unknown> = {};
  if (typeof input.title === "string") cols.title = input.title.slice(0, 1000);
  if (input.descriptionHtml !== undefined) cols.descriptionHtml = input.descriptionHtml?.slice(0, 100_000) || null;
  if (input.location !== undefined) cols.location = input.location?.slice(0, 2000) || null;
  if (input.status && STATUSES.has(input.status)) cols.status = input.status;
  if (input.transparency === "opaque" || input.transparency === "transparent") cols.transparency = input.transparency;
  if (input.visibility && VISIBILITIES.has(input.visibility)) cols.visibility = input.visibility;
  if (input.eventType && EVENT_TYPES.has(input.eventType)) cols.eventType = input.eventType;
  if (input.eventTypeProps) cols.eventTypeProps = JSON.stringify(input.eventTypeProps);
  if (input.color !== undefined) cols.color = input.color || null;
  if (input.conference !== undefined)
    cols.conference = JSON.stringify(
      input.conference ? { type: input.conference.type, url: input.conference.url ?? null, create: !!input.conference.create && !input.conference.url } : null,
    );
  if (typeof input.guestsCanModify === "boolean") cols.guestsCanModify = input.guestsCanModify;
  if (typeof input.guestsCanInviteOthers === "boolean") cols.guestsCanInviteOthers = input.guestsCanInviteOthers;
  if (typeof input.guestsCanSeeOthers === "boolean") cols.guestsCanSeeOthers = input.guestsCanSeeOthers;
  if (input.meetingRecordingId !== undefined) cols.meetingRecordingId = input.meetingRecordingId || null;
  if (input.rrule !== undefined) cols.rrule = input.rrule?.filter((l) => /^(RRULE|EXDATE|RDATE)[;:]/i.test(l)).slice(0, 20) || null;
  return cols;
}

export async function replaceAttendees(eventId: string, attendees: NormalizedAttendee[]) {
  const keep = attendees.map((a) => a.email);
  await db
    .deleteFrom("calendar_event_attendee")
    .where("eventId", "=", eventId)
    .where("email", "not in", keep.length ? keep : ["__none__"])
    .execute();
  for (const a of attendees) {
    await db
      .insertInto("calendar_event_attendee")
      .values({
        id: crypto.randomUUID(),
        eventId,
        email: a.email,
        name: a.name ?? null,
        role: a.role ?? "required",
        status: a.status ?? "needs_action",
        comment: a.comment ?? null,
        isOrganizer: !!a.isOrganizer,
        isSelf: !!a.isSelf,
        additionalGuests: a.additionalGuests ?? 0,
        contactId: null,
        userId: null,
        localStatus: null,
        respondedAt: null,
        proposedStart: null,
        proposedEnd: null,
      })
      .onConflict((oc) =>
        oc.columns(["eventId", "email"]).doUpdateSet({ name: a.name ?? null, role: a.role ?? "required", isOrganizer: !!a.isOrganizer, isSelf: !!a.isSelf }),
      )
      .execute();
  }
  const text = attendees
    .map((a) => `${a.name ?? ""} ${a.email}`)
    .join(" ")
    .slice(0, 4000);
  await db.updateTable("calendar_event").set({ attendeeText: text }).where("id", "=", eventId).execute();
}

/** Learns event participants into the calendar's contact book. */
export async function learnFromEvent(
  calendar: CalendarRow,
  event: Pick<EventRow, "organizer" | "startAt" | "startDate" | "attendeesOmitted">,
  attendees: NormalizedAttendee[],
  actingUserId: string,
) {
  if (calendar.kind === "subscription" || calendar.kind === "holiday" || event.attendeesOmitted || !attendees.length) return;
  const bookId = await bookIdForCalendar(calendar, actingUserId);
  const self = await selfAddresses(calendar, actingUserId);
  const organizer = event.organizer?.email?.toLowerCase() ?? null;
  const at = event.startAt ?? (event.startDate ? dateToUtcMidnight(event.startDate) : new Date());
  const selfStatus = attendees.find((a) => self.has(a.email.toLowerCase()))?.status;
  const byMe = !organizer || self.has(organizer);
  const interaction: Interaction = selfStatus === "declined" ? "declined" : byMe ? "organized_by_me" : "meeting";
  // The organizer is learned once below (as organizer), not again as an attendee.
  const people = attendees.filter((a) => a.role !== "resource" && (byMe || a.email.toLowerCase() !== organizer)).map((a) => ({ email: a.email, name: a.name }));
  const base = {
    organizationId: calendar.organizationId,
    bookId,
    self,
    source: "calendar" as const,
    at: at > new Date() ? new Date() : at,
    groupSize: people.length,
    meetingAt: at,
  };
  await learnContacts({ ...base, people, interaction });
  if (organizer && !byMe) await learnContacts({ ...base, people: [{ email: organizer, name: event.organizer?.name }], interaction: "organized_by_them" });
}

async function organizerFor(calendar: CalendarRow, userId: string): Promise<CalendarPerson> {
  if (calendar.accountId) {
    const account = await db.selectFrom("connected_account").select(["address", "displayName"]).where("id", "=", calendar.accountId).executeTakeFirstOrThrow();
    return { email: account.address, name: account.displayName, self: true };
  }
  const user = await db.selectFrom("user").select(["email", "name"]).where("id", "=", userId).executeTakeFirstOrThrow();
  return { email: user.email.toLowerCase(), name: user.name, self: true };
}

async function writeEventReminders(eventId: string, reminders: CalendarReminderSpec[] | null | undefined, local: boolean, userId: string) {
  if (reminders === undefined) return;
  if (!local) return writeReminders(eventId, reminders);
  await db.deleteFrom("calendar_event_reminder").where("eventId", "=", eventId).where("userId", "=", userId).execute();
  if (reminders?.length) {
    await db
      .insertInto("calendar_event_reminder")
      .values(reminders.map((r) => ({ id: crypto.randomUUID(), eventId, userId, method: r.method, minutesBefore: r.minutes, localOnly: true })))
      .execute();
  }
}

function hasExternalGuests(attendees: NormalizedAttendee[]) {
  return attendees.some((a) => !a.isSelf && a.role !== "resource");
}

// ── create ───────────────────────────────────────────────────────────────────

export async function createEvent(organizationId: string, userId: string, input: EventInput, opts: { source?: string; uid?: string } = {}): Promise<string> {
  if (!input.calendarId) throw new CalendarAccessError(400, "calendar_required");
  const { calendar, role } = await requireCalendar(organizationId, userId, input.calendarId, "editor");
  const self = await selfAddresses(calendar, userId);
  const attendees = cleanAttendees(input.attendees, self);
  const organizer = await organizerFor(calendar, userId);
  const id = crypto.randomUUID();
  const now = new Date();
  const time = timeColumns(input, calendar.timezone);
  await db
    .insertInto("calendar_event")
    .values({
      id,
      organizationId,
      calendarId: calendar.id,
      uid: opts.uid ?? `${id}@twodb`,
      providerEventId: null,
      etag: null,
      recurringEventId: null,
      originalStartAt: null,
      descriptionHtml: null,
      location: null,
      geo: JSON.stringify(null),
      color: null,
      organizer: JSON.stringify(organizer),
      conference: JSON.stringify(null),
      eventTypeProps: "{}",
      meetingRecordingId: null,
      rawIcs: null,
      providerData: "{}",
      providerUpdatedAt: null,
      localOnlyFields: "{}",
      localDeletedAt: null,
      createdByUserId: userId,
      source: opts.source ?? "local",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedSource: null,
      ...time,
      ...scalarColumns(input),
    })
    .execute();
  await replaceAttendees(id, attendees);
  await writeEventReminders(id, input.reminders, await remindersAreLocal(calendar, role), userId);
  await rebuildOccurrences(id);
  const event = await db.selectFrom("calendar_event").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
  await queueChange({ event, op: "create", before: null, userId });
  await learnFromEvent(calendar, event, attendees, userId);
  if (!calendar.accountId && hasExternalGuests(attendees)) await inviteHook(id, userId, "REQUEST");
  await notify(calendar.id, { type: "event.changed", calendarId: calendar.id, eventIds: [id] });
  return id;
}

// ── update ───────────────────────────────────────────────────────────────────

/** Snapshot of one instance as it looks before an override exists. */
function instanceSnapshot(master: EventRow, attendees: NormalizedAttendee[], reminders: CalendarReminderSpec[] | null, originalStart: Date): EventSnapshot {
  const duration = master.isAllDay ? 0 : (master.endAt?.getTime() ?? 0) - (master.startAt?.getTime() ?? 0);
  const dayLength =
    master.isAllDay && master.startDate && master.endDate
      ? (dateToUtcMidnight(master.endDate).getTime() - dateToUtcMidnight(master.startDate).getTime()) / 86_400_000
      : 1;
  const startDate = originalStart.toISOString().slice(0, 10);
  return buildSnapshot(
    {
      ...master,
      rrule: null,
      startAt: master.isAllDay ? null : originalStart,
      endAt: master.isAllDay ? null : new Date(originalStart.getTime() + duration),
      startDate: master.isAllDay ? startDate : null,
      endDate: master.isAllDay ? addDays(startDate, dayLength) : null,
    },
    attendees,
    reminders,
  );
}

async function createOverride(master: EventRow, originalStart: Date): Promise<EventRow> {
  if (!hasInstance(master, originalStart)) throw new CalendarAccessError(400, "occurrence_not_found");
  const existing = await db
    .selectFrom("calendar_event")
    .selectAll()
    .where("recurringEventId", "=", master.id)
    .where((eb) => (master.isAllDay ? eb("originalStartDate", "=", originalStart.toISOString().slice(0, 10)) : eb("originalStartAt", "=", originalStart)))
    .executeTakeFirst();
  if (existing) return existing;
  const snap = instanceSnapshot(master, [], null, originalStart);
  const id = crypto.randomUUID();
  const now = new Date();
  const { searchVector: _sv, ...masterCols } = master;
  await db
    .insertInto("calendar_event")
    .values({
      ...masterCols,
      id,
      providerEventId: null,
      etag: null,
      recurringEventId: master.id,
      originalStartAt: master.isAllDay ? dateToUtcMidnight(originalStart.toISOString().slice(0, 10)) : originalStart,
      originalStartDate: master.isAllDay ? originalStart.toISOString().slice(0, 10) : null,
      rrule: null,
      startAt: snap.time.startAt ? new Date(snap.time.startAt) : null,
      endAt: snap.time.endAt ? new Date(snap.time.endAt) : null,
      startDate: snap.time.startDate,
      endDate: snap.time.endDate,
      geo: JSON.stringify(master.geo),
      organizer: JSON.stringify(master.organizer),
      conference: JSON.stringify(master.conference),
      eventTypeProps: JSON.stringify(master.eventTypeProps),
      providerData: "{}",
      localOnlyFields: "{}",
      pushState: "none",
      localOnly: false,
      sequence: master.sequence,
      createdAt: now,
      updatedAt: now,
    })
    .execute();
  await replaceAttendees(id, await loadAttendees(master.id));
  const reminders = await loadReminders(master.id);
  if (reminders) await writeReminders(id, reminders);
  return db.selectFrom("calendar_event").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
}

async function applyInput(
  event: EventRow,
  calendar: CalendarRow,
  input: EventInput,
  userId: string,
  role: CalendarRole,
  opts: { shiftFrom?: Date | null } = {},
) {
  const cols: Record<string, unknown> = { ...scalarColumns(input), updatedAt: new Date() };
  if (event.recurringEventId) delete cols.rrule;
  const timeTouched = input.isAllDay !== undefined || input.startAt !== undefined || input.startDate !== undefined;
  if (timeTouched) {
    const merged: EventInput = {
      isAllDay: input.isAllDay ?? event.isAllDay,
      startAt: input.startAt ?? event.startAt?.toISOString(),
      endAt: input.endAt ?? event.endAt?.toISOString(),
      startDate: input.startDate ?? event.startDate,
      endDate: input.endDate ?? event.endDate,
      startTz: input.startTz ?? event.startTz,
      endTz: input.endTz ?? event.endTz,
    };
    let time: Record<string, unknown> & { isAllDay: boolean; startAt: Date | null; endAt: Date | null; startDate: string | null; endDate: string | null } =
      timeColumns(merged, calendar.timezone);
    // Dragging one occurrence of a series with scope=all shifts the master by the same delta.
    if (opts.shiftFrom && !time.isAllDay && !event.isAllDay && event.startAt && event.endAt) {
      const delta = time.startAt!.getTime() - opts.shiftFrom.getTime();
      const duration = time.endAt!.getTime() - time.startAt!.getTime();
      const startAt = new Date(event.startAt.getTime() + delta);
      time = { ...time, startAt, endAt: new Date(startAt.getTime() + duration) };
    } else if (opts.shiftFrom && time.isAllDay && event.isAllDay && event.startDate) {
      const delta = (dateToUtcMidnight(time.startDate!).getTime() - opts.shiftFrom.getTime()) / 86_400_000;
      const length = (dateToUtcMidnight(time.endDate!).getTime() - dateToUtcMidnight(time.startDate!).getTime()) / 86_400_000;
      const startDate = addDays(event.startDate, Math.round(delta));
      time = { ...time, startDate, endDate: addDays(startDate, length) };
    }
    Object.assign(cols, time);
  }
  await db.updateTable("calendar_event").set(cols).where("id", "=", event.id).execute();
  let added: NormalizedAttendee[] = [];
  if (input.attendees) {
    const self = await selfAddresses(calendar, userId);
    const current = await loadAttendees(event.id);
    const next = cleanAttendees(input.attendees, self).map((a) => {
      const prev = current.find((c) => c.email === a.email);
      return prev ? { ...prev, name: a.name ?? prev.name, role: a.role } : a;
    });
    added = next.filter((a) => !current.some((c) => c.email === a.email));
    await replaceAttendees(event.id, next);
  }
  await writeEventReminders(event.id, input.reminders, await remindersAreLocal(calendar, role), userId);
  return { added };
}

export async function updateEvent(
  organizationId: string,
  userId: string,
  eventId: string,
  input: EventInput,
  scope: RecurrenceScope = "all",
  occurrenceStart?: string | null,
): Promise<string> {
  const access = await requireEvent(organizationId, userId, eventId, "editor");
  let { event } = access;
  const { calendar, role } = access;
  if (event.localDeletedAt || event.deletedAt) throw new CalendarAccessError(409, "event_deleted");
  const occ = occurrenceStart ? new Date(occurrenceStart) : null;
  if (input.calendarId && input.calendarId !== event.calendarId) {
    await moveEvent(organizationId, userId, eventId, input.calendarId);
    event = await db.selectFrom("calendar_event").selectAll().where("id", "=", eventId).executeTakeFirstOrThrow();
  }

  // Override row: "all" edits go to the master; anything else edits the instance.
  if (event.recurringEventId && scope !== "this") {
    const master = await db.selectFrom("calendar_event").selectAll().where("id", "=", event.recurringEventId).executeTakeFirst();
    if (master) return updateEvent(organizationId, userId, master.id, input, scope, (event.originalStartAt ?? occ)?.toISOString() ?? null);
  }

  let target = event;
  let queueScope: RecurrenceScope = "all";
  let before: EventSnapshot | null;
  let shiftFrom: Date | null = null;

  if (event.rrule?.length && scope === "this") {
    if (!occ) throw new CalendarAccessError(400, "occurrence_required");
    const attendees = await loadAttendees(event.id);
    const reminders = await loadReminders(event.id);
    const existing = await db
      .selectFrom("calendar_event")
      .selectAll()
      .where("recurringEventId", "=", event.id)
      .where((eb) => (event.isAllDay ? eb("originalStartDate", "=", occ.toISOString().slice(0, 10)) : eb("originalStartAt", "=", occ)))
      .executeTakeFirst();
    before = existing ? await snapshotEvent(existing.id) : instanceSnapshot(event, attendees, reminders, occ);
    target = existing ?? (await createOverride(event, occ));
    queueScope = "this";
  } else if (event.rrule?.length && scope === "following" && occ) {
    return splitSeries(organizationId, userId, event, calendar, role, occ, input);
  } else {
    before = await snapshotEvent(event.id);
    if (event.rrule?.length && occ && scope === "all") shiftFrom = event.isAllDay ? dateToUtcMidnight(occ.toISOString().slice(0, 10)) : occ;
    if (event.recurringEventId) queueScope = "this";
  }

  const { added } = await applyInput(target, calendar, input, userId, role, { shiftFrom });
  if (shiftFrom) await shiftOverrides(target);
  await rebuildOccurrences(target.id);
  const fresh = await db.selectFrom("calendar_event").selectAll().where("id", "=", target.id).executeTakeFirstOrThrow();
  await queueChange({
    event: fresh,
    op: "update",
    before,
    userId,
    scope: queueScope,
    occurrenceStart: queueScope === "this" ? (fresh.originalStartAt ?? occ) : null,
  });
  if (added.length) await learnFromEvent(calendar, fresh, added, userId);
  if (!calendar.accountId && hasExternalGuests(await loadAttendees(fresh.id))) await inviteHook(fresh.id, userId, "REQUEST");
  await notify(calendar.id, { type: "event.changed", calendarId: calendar.id, eventIds: [target.id] });
  return target.id;
}

/** After a whole series moves in time, its overrides' RECURRENCE-IDs (and EXDATEs) move with it. */
async function shiftOverrides(before: EventRow) {
  const after = await db.selectFrom("calendar_event").selectAll().where("id", "=", before.id).executeTakeFirstOrThrow();
  const oldStart = before.isAllDay ? dateToUtcMidnight(before.startDate!).getTime() : before.startAt!.getTime();
  const newStart = after.isAllDay ? dateToUtcMidnight(after.startDate!).getTime() : after.startAt!.getTime();
  const delta = newStart - oldStart;
  if (!delta || before.isAllDay !== after.isAllDay) return;
  const overrides = await db
    .selectFrom("calendar_event")
    .select(["id", "originalStartAt", "originalStartDate"])
    .where("recurringEventId", "=", before.id)
    .execute();
  for (const o of overrides) {
    const at = o.originalStartAt ? new Date(o.originalStartAt.getTime() + delta) : null;
    await db
      .updateTable("calendar_event")
      .set({ originalStartAt: at, originalStartDate: o.originalStartDate && at ? at.toISOString().slice(0, 10) : o.originalStartDate })
      .where("id", "=", o.id)
      .execute();
  }
  if (after.rrule?.some((l) => /^EXDATE/i.test(l))) {
    const shifted = after.rrule.map((line) => {
      if (!/^EXDATE/i.test(line)) return line;
      const head = line.slice(0, line.indexOf(":"));
      const values = line
        .slice(line.indexOf(":") + 1)
        .split(",")
        .map((v) => {
          const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
          if (!m) return v;
          const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)) + delta);
          const iso = d
            .toISOString()
            .replace(/[-:]/g, "")
            .replace(/\.\d{3}/, "");
          return m[4] ? (m[7] ? iso : iso.replace(/Z$/, "")) : iso.slice(0, 8);
        });
      return `${head}:${values.join(",")}`;
    });
    await db.updateTable("calendar_event").set({ rrule: shifted }).where("id", "=", before.id).execute();
  }
}

/** "This and following": end the old series before the split, start a new one from it. */
async function splitSeries(
  organizationId: string,
  userId: string,
  master: EventRow,
  calendar: CalendarRow,
  role: CalendarRole,
  splitAt: Date,
  input: EventInput,
): Promise<string> {
  const firstStart = master.isAllDay ? dateToUtcMidnight(master.startDate!) : master.startAt!;
  if (splitAt.getTime() <= firstStart.getTime()) return updateEvent(organizationId, userId, master.id, input, "all", splitAt.toISOString());
  const before = await snapshotEvent(master.id);
  const attendees = await loadAttendees(master.id);
  const reminders = await loadReminders(master.id);
  await db
    .updateTable("calendar_event")
    .set({ rrule: truncateBefore(master, splitAt), updatedAt: new Date() })
    .where("id", "=", master.id)
    .execute();
  const truncated = await db.selectFrom("calendar_event").selectAll().where("id", "=", master.id).executeTakeFirstOrThrow();
  await queueChange({ event: truncated, op: "update", before, userId });

  const inst = instanceSnapshot(master, attendees, reminders, splitAt);
  const newId = await createEvent(organizationId, userId, {
    calendarId: calendar.id,
    title: master.title,
    descriptionHtml: master.descriptionHtml,
    location: master.location,
    isAllDay: master.isAllDay,
    startAt: inst.time.startAt,
    endAt: inst.time.endAt,
    startDate: inst.time.startDate,
    endDate: inst.time.endDate,
    startTz: master.startTz,
    endTz: master.endTz,
    rrule: continueFrom(master),
    status: master.status,
    transparency: master.transparency,
    visibility: master.visibility,
    eventType: master.eventType,
    color: master.color,
    conference: master.conference ? { type: master.conference.type, url: master.conference.url } : null,
    attendees: attendees.map((a) => ({ email: a.email, name: a.name, role: a.role })),
    reminders,
    guestsCanModify: master.guestsCanModify,
    guestsCanInviteOthers: master.guestsCanInviteOthers,
    guestsCanSeeOthers: master.guestsCanSeeOthers,
    ...input,
  });
  // Overrides after the split move to the new series.
  await db
    .updateTable("calendar_event")
    .set({ recurringEventId: newId })
    .where("recurringEventId", "=", master.id)
    .where((eb) => eb.or([eb("originalStartAt", ">=", splitAt), eb("originalStartDate", ">=", splitAt.toISOString().slice(0, 10))]))
    .execute();
  await rebuildOccurrences(master.id);
  await rebuildOccurrences(newId);
  void role;
  await notify(calendar.id, { type: "event.changed", calendarId: calendar.id, eventIds: [master.id, newId] });
  return newId;
}

// ── delete / restore ─────────────────────────────────────────────────────────

export async function deleteEvent(
  organizationId: string,
  userId: string,
  eventId: string,
  scope: RecurrenceScope = "all",
  occurrenceStart?: string | null,
): Promise<void> {
  const { event, calendar } = await requireEvent(organizationId, userId, eventId, "editor");
  const occ = occurrenceStart ? new Date(occurrenceStart) : null;
  const now = new Date();

  if (event.recurringEventId && scope !== "this") {
    return deleteEvent(organizationId, userId, event.recurringEventId, scope, (event.originalStartAt ?? occ)?.toISOString() ?? null);
  }

  if ((event.rrule?.length && scope === "this") || event.recurringEventId) {
    const target = event.recurringEventId
      ? event
      : await createOverride(
          event,
          occ ??
            (() => {
              throw new CalendarAccessError(400, "occurrence_required");
            })(),
        );
    const before = await snapshotEvent(target.id);
    await db.updateTable("calendar_event").set({ status: "cancelled", updatedAt: now }).where("id", "=", target.id).execute();
    const fresh = await db.selectFrom("calendar_event").selectAll().where("id", "=", target.id).executeTakeFirstOrThrow();
    await queueChange({ event: fresh, op: "cancel_instance", before, userId, scope: "this", occurrenceStart: fresh.originalStartAt });
    await rebuildOccurrences(target.id);
    if (!calendar.accountId && hasExternalGuests(await loadAttendees(target.id))) await inviteHook(target.id, userId, "CANCEL");
  } else if (event.rrule?.length && scope === "following" && occ) {
    const before = await snapshotEvent(event.id);
    await db
      .updateTable("calendar_event")
      .set({ rrule: truncateBefore(event, occ), updatedAt: now })
      .where("id", "=", event.id)
      .execute();
    await db
      .updateTable("calendar_event")
      .set({ deletedAt: now, deletedSource: "user" })
      .where("recurringEventId", "=", event.id)
      .where((eb) => eb.or([eb("originalStartAt", ">=", occ), eb("originalStartDate", ">=", occ.toISOString().slice(0, 10))]))
      .execute();
    const fresh = await db.selectFrom("calendar_event").selectAll().where("id", "=", event.id).executeTakeFirstOrThrow();
    await queueChange({ event: fresh, op: "update", before, userId });
    await rebuildOccurrences(event.id);
  } else {
    const before = await snapshotEvent(event.id);
    await db.updateTable("calendar_event").set({ deletedAt: now, deletedSource: "user", updatedAt: now }).where("id", "=", event.id).execute();
    await queueChange({ event, op: "delete", before, userId });
    await rebuildOccurrences(event.id);
    if (!calendar.accountId && hasExternalGuests(await loadAttendees(event.id))) await inviteHook(event.id, userId, "CANCEL");
  }
  await notify(calendar.id, { type: "event.changed", calendarId: calendar.id, eventIds: [event.id] });
}

export async function restoreEvent(organizationId: string, userId: string, eventId: string): Promise<void> {
  const { event, calendar } = await requireEvent(organizationId, userId, eventId, "editor");
  if (!event.deletedAt) return;
  const pendingDelete = await db
    .selectFrom("calendar_change")
    .select("id")
    .where("eventId", "=", eventId)
    .where("op", "=", "delete")
    .where("status", "=", "awaiting_approval")
    .executeTakeFirst();
  await db.updateTable("calendar_event").set({ deletedAt: null, deletedSource: null, updatedAt: new Date() }).where("id", "=", eventId).execute();
  if (pendingDelete) {
    await db
      .updateTable("calendar_change")
      .set({ status: "discarded", decidedAt: new Date(), updatedAt: new Date() })
      .where("id", "=", pendingDelete.id)
      .execute();
    await setPushState(eventId);
  } else if (calendar.accountId) {
    // Already gone at the provider: recreate it there (after approval).
    await db.updateTable("calendar_event").set({ providerEventId: null, etag: null }).where("id", "=", eventId).execute();
    const fresh = await db.selectFrom("calendar_event").selectAll().where("id", "=", eventId).executeTakeFirstOrThrow();
    await queueChange({ event: fresh, op: "create", before: null, userId });
  }
  await rebuildOccurrences(eventId);
  await notify(calendar.id, { type: "event.changed", calendarId: calendar.id, eventIds: [eventId] });
}

/** Permanently removes trashed events (twodb calendars, or provider events whose delete already went out). */
export async function purgeEvents(organizationId: string, userId: string, eventIds: string[] | "all"): Promise<number> {
  const access = await accessibleCalendars(organizationId, userId);
  const writable = access.filter((a) => roleAtLeast(a.role, "editor")).map((a) => a.calendar.id);
  if (!writable.length) return 0;
  let q = db
    .selectFrom("calendar_event")
    .select("id")
    .where("calendarId", "in", writable)
    .where("deletedAt", "is not", null)
    .where("deletedSource", "=", "user")
    .where(
      sql<boolean>`not exists (select 1 from calendar_change c where c."eventId" = calendar_event.id and c.status in ('awaiting_approval', 'pending', 'sending', 'failed', 'conflict'))`,
    );
  if (eventIds !== "all") q = q.where("id", "in", eventIds.length ? eventIds : ["__none__"]);
  const rows = await q.execute();
  const ids = rows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    // Provider-backed rows stay as tombstones (unique provider id blocks re-import); local rows go.
    await db.deleteFrom("calendar_event").where("id", "in", chunk).where("providerEventId", "is", null).execute();
    await db.updateTable("calendar_event").set({ deletedSource: "purged" }).where("id", "in", chunk).execute();
  }
  return ids.length;
}

// ── rsvp / move / duplicate ──────────────────────────────────────────────────

export async function respondToEvent(
  organizationId: string,
  userId: string,
  eventId: string,
  status: string,
  comment: string | null,
  scope: RecurrenceScope = "all",
  occurrenceStart?: string | null,
) {
  if (!["accepted", "declined", "tentative"].includes(status)) throw new CalendarAccessError(400, "invalid_status");
  const access = await requireEvent(organizationId, userId, eventId, "viewer");
  const { calendar } = access;
  if (!calendar.accountId && access.calendar.ownerUserId !== userId) throw new CalendarAccessError(403, "forbidden");
  if (calendar.accountId && !access.canApprove) throw new CalendarAccessError(403, "forbidden");
  let event = access.event;
  if (event.rrule?.length && scope === "this" && occurrenceStart) event = await createOverride(event, new Date(occurrenceStart));
  const self = await selfAddresses(calendar, userId);
  const attendees = await loadAttendees(event.id);
  const me = attendees.find((a) => self.has(a.email.toLowerCase()));
  if (!me) throw new CalendarAccessError(400, "not_an_attendee");
  await db
    .updateTable("calendar_event_attendee")
    .set({ status, comment, respondedAt: new Date(), localStatus: null })
    .where("eventId", "=", event.id)
    .where("email", "=", me.email)
    .execute();
  await queueChange({
    event,
    op: "rsvp",
    before: null,
    userId,
    scope: event.recurringEventId ? "this" : "all",
    occurrenceStart: event.originalStartAt,
    payload: { status, previous: me.status, email: me.email, comment },
  });
  if (!calendar.accountId && event.organizer && !self.has(event.organizer.email.toLowerCase()))
    await inviteHook(event.id, userId, "REPLY", { status, comment });
  await rebuildOccurrences(event.id);
  await notify(calendar.id, { type: "event.changed", calendarId: calendar.id, eventIds: [event.id] });
}

export async function moveEvent(organizationId: string, userId: string, eventId: string, toCalendarId: string) {
  const { event, calendar: from } = await requireEvent(organizationId, userId, eventId, "editor");
  const { calendar: to } = await requireCalendar(organizationId, userId, toCalendarId, "editor");
  if (from.id === to.id) return;
  if ((from.accountId ?? null) !== (to.accountId ?? null)) throw new CalendarAccessError(400, "cross_account_move_blocked");
  if (event.recurringEventId) throw new CalendarAccessError(400, "move_series_instead");
  const before = await snapshotEvent(event.id);
  await db
    .updateTable("calendar_event")
    .set({ calendarId: to.id, updatedAt: new Date() })
    .where((eb) => eb.or([eb("id", "=", eventId), eb("recurringEventId", "=", eventId)]))
    .execute();
  await db.updateTable("calendar_occurrence").set({ calendarId: to.id }).where("eventId", "=", eventId).execute();
  const fresh = await db.selectFrom("calendar_event").selectAll().where("id", "=", eventId).executeTakeFirstOrThrow();
  if (from.accountId) await queueChange({ event: fresh, op: "move", before, userId, payload: { fromCalendarId: from.id, toCalendarId: to.id } });
  await notify(from.id, { type: "event.changed", calendarId: from.id, eventIds: [eventId] });
  await notify(to.id, { type: "event.changed", calendarId: to.id, eventIds: [eventId] });
}

export async function duplicateEvent(organizationId: string, userId: string, eventId: string, toCalendarId?: string | null): Promise<string> {
  const { event } = await requireEvent(organizationId, userId, eventId, "viewer");
  const attendees = await loadAttendees(event.id);
  const reminders = await loadReminders(event.id);
  return createEvent(organizationId, userId, {
    calendarId: toCalendarId || event.calendarId,
    title: event.title,
    descriptionHtml: event.descriptionHtml,
    location: event.location,
    isAllDay: event.isAllDay,
    startAt: event.startAt?.toISOString() ?? null,
    endAt: event.endAt?.toISOString() ?? null,
    startDate: event.startDate,
    endDate: event.endDate,
    startTz: event.startTz,
    endTz: event.endTz,
    rrule: event.recurringEventId ? null : event.rrule,
    transparency: event.transparency,
    visibility: event.visibility,
    eventType: event.eventType,
    color: event.color,
    conference: event.conference?.url ? { type: event.conference.type, url: event.conference.url } : null,
    attendees: attendees.filter((a) => !a.isSelf).map((a) => ({ email: a.email, name: a.name, role: a.role })),
    reminders,
  });
}

// ── reads ────────────────────────────────────────────────────────────────────

export interface OccurrencePayload {
  key: string;
  eventId: string;
  seriesId: string | null;
  calendarId: string;
  title: string;
  location: string | null;
  isAllDay: boolean;
  startAt: string;
  endAt: string;
  startDate: string | null;
  endDate: string | null;
  originalStart: string | null;
  status: string;
  transparency: string;
  eventType: string;
  color: string | null;
  isRecurring: boolean;
  attendeeCount: number;
  selfStatus: string | null;
  hasConference: boolean;
  pushState: string;
  localOnly: boolean;
  busyOnly: boolean;
}

export async function listOccurrences(organizationId: string, userId: string, from: Date, to: Date, calendarIds?: string[]): Promise<OccurrencePayload[]> {
  const access = await accessibleCalendars(organizationId, userId);
  const visible = access.filter((a) => !calendarIds?.length || calendarIds.includes(a.calendar.id));
  if (!visible.length) return [];
  const ids = visible.map((a) => a.calendar.id);
  await ensureWindow(ids, from, to);
  const roles = new Map(visible.map((a) => [a.calendar.id, a.role]));
  const rows = await db
    .selectFrom("calendar_occurrence as o")
    .innerJoin("calendar_event as e", (j) => j.on(sql<boolean>`e.id = coalesce(o."overrideEventId", o."eventId")`))
    .select([
      "o.eventId",
      "o.overrideEventId",
      "o.calendarId",
      "o.startAt",
      "o.endAt",
      "o.startDate",
      "o.endDate",
      "o.isAllDay",
      "o.status",
      "o.transparency",
      "e.id as rowId",
      "e.title",
      "e.location",
      "e.eventType",
      "e.color",
      "e.rrule",
      "e.recurringEventId",
      "e.originalStartAt",
      "e.conference",
      "e.pushState",
      "e.localOnly",
      "e.localOnlyFields",
      "e.visibility",
    ])
    .where("o.calendarId", "in", ids)
    .where("o.startAt", "<", to)
    .where("o.endAt", ">", from)
    .orderBy("o.startAt")
    .limit(5000)
    .execute();
  const eventIds = [...new Set(rows.map((r) => r.rowId))];
  const attendeeRows = eventIds.length
    ? await db.selectFrom("calendar_event_attendee").select(["eventId", "isSelf", "status", "localStatus"]).where("eventId", "in", eventIds).execute()
    : [];
  const byEvent = new Map<string, { count: number; self: string | null }>();
  for (const a of attendeeRows) {
    const cur = byEvent.get(a.eventId) ?? { count: 0, self: null };
    cur.count += 1;
    if (a.isSelf) cur.self = a.localStatus ?? a.status;
    byEvent.set(a.eventId, cur);
  }
  return rows.map((r) => {
    const busyOnly = roles.get(r.calendarId) === "free_busy" || (r.visibility === "private" && roles.get(r.calendarId) === "viewer");
    const series = r.recurringEventId ?? (r.rrule?.length ? r.rowId : null);
    const isInstance = !!series;
    return {
      key: `${r.eventId}:${r.startAt.toISOString()}`,
      eventId: r.rowId,
      seriesId: series,
      calendarId: r.calendarId,
      title: busyOnly ? "Busy" : r.title,
      location: busyOnly ? null : r.location,
      isAllDay: r.isAllDay,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      startDate: r.startDate,
      endDate: r.endDate,
      originalStart: isInstance ? (r.originalStartAt ?? r.startAt).toISOString() : null,
      status: r.status,
      transparency: r.transparency,
      eventType: r.eventType,
      color: r.color,
      isRecurring: isInstance,
      attendeeCount: byEvent.get(r.rowId)?.count ?? 0,
      selfStatus: byEvent.get(r.rowId)?.self ?? null,
      hasConference: !!r.conference?.url || !!r.conference?.create,
      pushState: r.pushState,
      localOnly: r.localOnly || Object.keys(r.localOnlyFields ?? {}).length > 0,
      busyOnly,
    };
  });
}

export async function getEventDetail(organizationId: string, userId: string, eventId: string) {
  const { event, calendar, role, canApprove } = await requireEvent(organizationId, userId, eventId, "free_busy");
  const master = event.recurringEventId ? await db.selectFrom("calendar_event").selectAll().where("id", "=", event.recurringEventId).executeTakeFirst() : null;
  const attendees = await db
    .selectFrom("calendar_event_attendee")
    .selectAll()
    .where("eventId", "=", event.id)
    .orderBy("isOrganizer", "desc")
    .orderBy("email")
    .execute();
  const reminders = await db
    .selectFrom("calendar_event_reminder")
    .selectAll()
    .where("eventId", "=", event.id)
    .where((eb) => eb.or([eb("userId", "is", null), eb("userId", "=", userId)]))
    .execute();
  const attachments = await db.selectFrom("calendar_event_attachment").selectAll().where("eventId", "=", event.id).execute();
  const changes = await db
    .selectFrom("calendar_change")
    .select(["id", "op", "status", "fields", "remoteChangedFields", "remoteDeleted", "lastError", "updatedAt"])
    .where("eventId", "=", event.id)
    .where("status", "in", OPEN_STATUSES)
    .execute();
  const self = await selfAddresses(calendar, userId);
  const busyOnly = role === "free_busy";
  return {
    event: busyOnly
      ? { ...event, title: "Busy", descriptionHtml: null, location: null, searchVector: undefined }
      : { ...event, searchVector: undefined, rawIcs: undefined },
    master: master ? { id: master.id, rrule: master.rrule, title: master.title, startAt: master.startAt, startDate: master.startDate } : null,
    recurrenceText: describeRule(master?.rrule ?? event.rrule),
    calendar: { id: calendar.id, name: calendar.name, color: calendar.color, accountId: calendar.accountId, kind: calendar.kind, timezone: calendar.timezone },
    role,
    canEdit: roleAtLeast(role, "editor") && calendar.kind !== "subscription",
    canApprove,
    attendees: busyOnly ? [] : attendees.map((a) => ({ ...a, status: a.localStatus ?? a.status, isSelf: a.isSelf || self.has(a.email.toLowerCase()) })),
    reminders: reminders.filter((r) => r.minutesBefore >= 0).map((r) => ({ id: r.id, method: r.method, minutes: r.minutesBefore, personal: !!r.userId })),
    usesDefaultReminders: !reminders.some((r) => !r.userId),
    attachments,
    pending: changes,
    selfAddresses: [...self],
  };
}

export async function searchEvents(
  organizationId: string,
  userId: string,
  q: string,
  opts: { from?: Date; to?: Date; calendarIds?: string[]; limit?: number } = {},
) {
  const term = q.trim();
  if (!term) return [];
  const access = await accessibleCalendars(organizationId, userId);
  const ids = access.filter((a) => a.role !== "free_busy" && (!opts.calendarIds?.length || opts.calendarIds.includes(a.calendar.id))).map((a) => a.calendar.id);
  if (!ids.length) return [];
  let query = db
    .selectFrom("calendar_event")
    .select(["id", "calendarId", "title", "location", "isAllDay", "startAt", "endAt", "startDate", "endDate", "rrule", "recurringEventId"])
    .where("calendarId", "in", ids)
    .where("deletedAt", "is", null)
    .where("localDeletedAt", "is", null)
    .where(sql<boolean>`"searchVector" @@ websearch_to_tsquery('simple', ${term}) or title ilike ${`%${term.replace(/[%_\\]/g, "\\$&")}%`}`);
  if (opts.from)
    query = query.where((eb) =>
      eb.or([eb("endAt", ">=", opts.from!), eb("rrule", "is not", null), eb("endDate", ">=", opts.from!.toISOString().slice(0, 10))]),
    );
  if (opts.to) query = query.where((eb) => eb.or([eb("startAt", "<", opts.to!), eb("startDate", "<", opts.to!.toISOString().slice(0, 10))]));
  const rows = await query
    .orderBy(sql`ts_rank("searchVector", websearch_to_tsquery('simple', ${term}))`, "desc")
    .orderBy("startAt", "desc")
    .limit(opts.limit ?? 50)
    .execute();
  return rows;
}

export async function listTrash(organizationId: string, userId: string) {
  const access = await accessibleCalendars(organizationId, userId);
  const ids = access.filter((a) => roleAtLeast(a.role, "editor")).map((a) => a.calendar.id);
  if (!ids.length) return [];
  return db
    .selectFrom("calendar_event")
    .select(["id", "calendarId", "title", "isAllDay", "startAt", "startDate", "deletedAt", "rrule", "pushState"])
    .where("calendarId", "in", ids)
    .where("deletedAt", "is not", null)
    .where("deletedSource", "=", "user")
    .where("deletedAt", ">", new Date(Date.now() - 30 * 86_400_000))
    .orderBy("deletedAt", "desc")
    .limit(500)
    .execute();
}
