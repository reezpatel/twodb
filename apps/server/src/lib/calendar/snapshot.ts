import { db } from "../../auth";
import type { CalendarReminderSpec } from "../../plugins/db";
import type { EventRow, NormalizedAttendee } from "./types";

// A snapshot is the push-relevant shape of an event, per field. Pending push
// diffs compare snapshots; rejects pin fields by snapshot value; imports
// compare provider values against the snapshot to spot remote changes.

export const PUSH_FIELDS = [
  "title",
  "descriptionHtml",
  "location",
  "time",
  "rrule",
  "status",
  "transparency",
  "visibility",
  "eventType",
  "color",
  "conference",
  "attendees",
  "reminders",
  "guestPermissions",
] as const;

export type PushField = (typeof PUSH_FIELDS)[number];

export interface TimeValue {
  isAllDay: boolean;
  startAt: string | null;
  endAt: string | null;
  startDate: string | null;
  endDate: string | null;
  startTz: string | null;
  endTz: string | null;
}

export interface AttendeeValue {
  email: string;
  name: string | null;
  role: string;
}

export type EventSnapshot = {
  title: string;
  descriptionHtml: string | null;
  location: string | null;
  time: TimeValue;
  rrule: string[] | null;
  status: string;
  transparency: string;
  visibility: string;
  eventType: string;
  color: string | null;
  conference: unknown;
  attendees: AttendeeValue[];
  reminders: CalendarReminderSpec[] | null;
  guestPermissions: { modify: boolean; invite: boolean; see: boolean };
};

type SnapshotSource = Pick<
  EventRow,
  | "title"
  | "descriptionHtml"
  | "location"
  | "isAllDay"
  | "startAt"
  | "endAt"
  | "startDate"
  | "endDate"
  | "startTz"
  | "endTz"
  | "rrule"
  | "status"
  | "transparency"
  | "visibility"
  | "eventType"
  | "color"
  | "conference"
  | "guestsCanModify"
  | "guestsCanInviteOthers"
  | "guestsCanSeeOthers"
>;

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return typeof d === "string" ? new Date(d).toISOString() : d.toISOString();
}

export function buildSnapshot(e: SnapshotSource, attendees: NormalizedAttendee[], reminders: CalendarReminderSpec[] | null): EventSnapshot {
  return {
    title: e.title ?? "",
    descriptionHtml: e.descriptionHtml ?? null,
    location: e.location ?? null,
    time: {
      isAllDay: !!e.isAllDay,
      startAt: e.isAllDay ? null : iso(e.startAt),
      endAt: e.isAllDay ? null : iso(e.endAt),
      startDate: e.isAllDay ? (e.startDate ?? null) : null,
      endDate: e.isAllDay ? (e.endDate ?? null) : null,
      startTz: e.isAllDay ? null : (e.startTz ?? null),
      endTz: e.isAllDay ? null : (e.endTz ?? e.startTz ?? null),
    },
    rrule: e.rrule?.length ? [...e.rrule] : null,
    status: e.status ?? "confirmed",
    transparency: e.transparency ?? "opaque",
    visibility: e.visibility ?? "default",
    eventType: e.eventType ?? "default",
    color: e.color ?? null,
    conference: e.conference ? { type: e.conference.type, url: e.conference.url ?? null, create: !!e.conference.create } : null,
    attendees: attendees
      .map((a) => ({ email: a.email.toLowerCase(), name: a.name ?? null, role: a.role ?? "required" }))
      .sort((a, b) => a.email.localeCompare(b.email)),
    reminders: reminders
      ? [...reminders].map((r) => ({ method: r.method, minutes: r.minutes })).sort((a, b) => a.minutes - b.minutes || a.method.localeCompare(b.method))
      : null,
    guestPermissions: { modify: !!e.guestsCanModify, invite: e.guestsCanInviteOthers ?? true, see: e.guestsCanSeeOthers ?? true },
  };
}

export async function loadAttendees(eventId: string): Promise<NormalizedAttendee[]> {
  const rows = await db.selectFrom("calendar_event_attendee").selectAll().where("eventId", "=", eventId).execute();
  return rows.map((r) => ({
    email: r.email,
    name: r.name,
    role: r.role,
    status: r.status,
    comment: r.comment,
    isOrganizer: r.isOrganizer,
    isSelf: r.isSelf,
    additionalGuests: r.additionalGuests,
  }));
}

/** Event-level (synced) reminders; null = calendar defaults. */
export async function loadReminders(eventId: string): Promise<CalendarReminderSpec[] | null> {
  const rows = await db.selectFrom("calendar_event_reminder").selectAll().where("eventId", "=", eventId).where("userId", "is", null).execute();
  if (!rows.length) return null;
  if (rows.length === 1 && rows[0].minutesBefore < 0) return [];
  return rows.map((r) => ({ method: r.method as "popup" | "email", minutes: r.minutesBefore }));
}

export async function snapshotEvent(eventId: string): Promise<EventSnapshot | null> {
  const e = await db.selectFrom("calendar_event").selectAll().where("id", "=", eventId).executeTakeFirst();
  if (!e) return null;
  return buildSnapshot(e, await loadAttendees(eventId), await loadReminders(eventId));
}

export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function changedFields(before: EventSnapshot | null, after: EventSnapshot): PushField[] {
  if (!before) return [...PUSH_FIELDS];
  return PUSH_FIELDS.filter((f) => !sameValue(before[f], after[f]));
}

/** Event-row columns for one snapshot field (attendees/reminders are separate tables). */
export function columnsFor(field: PushField, snap: EventSnapshot): Record<string, unknown> {
  switch (field) {
    case "time":
      return {
        isAllDay: snap.time.isAllDay,
        startAt: snap.time.startAt ? new Date(snap.time.startAt) : null,
        endAt: snap.time.endAt ? new Date(snap.time.endAt) : null,
        startDate: snap.time.startDate,
        endDate: snap.time.endDate,
        startTz: snap.time.startTz,
        endTz: snap.time.endTz,
      };
    case "conference":
      return { conference: JSON.stringify(snap.conference ?? null) };
    case "guestPermissions":
      return {
        guestsCanModify: snap.guestPermissions.modify,
        guestsCanInviteOthers: snap.guestPermissions.invite,
        guestsCanSeeOthers: snap.guestPermissions.see,
      };
    case "attendees":
    case "reminders":
      return {};
    case "rrule":
      return { rrule: snap.rrule };
    default:
      return { [field]: snap[field] };
  }
}

/** Writes snapshot values for the given fields back onto the local event (discard / use theirs). */
export async function applySnapshotFields(eventId: string, snap: EventSnapshot, fields: PushField[]): Promise<void> {
  const cols: Record<string, unknown> = {};
  for (const f of fields) Object.assign(cols, columnsFor(f, snap));
  if (Object.keys(cols).length)
    await db
      .updateTable("calendar_event")
      .set({ ...cols, updatedAt: new Date() })
      .where("id", "=", eventId)
      .execute();
  if (fields.includes("attendees")) {
    const keep = new Set(snap.attendees.map((a) => a.email));
    await db
      .deleteFrom("calendar_event_attendee")
      .where("eventId", "=", eventId)
      .where("email", "not in", [...keep, "__none__"])
      .execute();
    for (const a of snap.attendees) {
      await db
        .insertInto("calendar_event_attendee")
        .values({
          id: crypto.randomUUID(),
          eventId,
          email: a.email,
          name: a.name,
          role: a.role,
          contactId: null,
          userId: null,
          localStatus: null,
          comment: null,
          respondedAt: null,
          proposedStart: null,
          proposedEnd: null,
        })
        .onConflict((oc) => oc.columns(["eventId", "email"]).doUpdateSet({ name: a.name, role: a.role }))
        .execute();
    }
  }
  if (fields.includes("reminders")) await writeReminders(eventId, snap.reminders);
}

export async function writeReminders(eventId: string, reminders: CalendarReminderSpec[] | null, localOnly = false): Promise<void> {
  await db.deleteFrom("calendar_event_reminder").where("eventId", "=", eventId).where("userId", "is", null).execute();
  if (reminders === null) return;
  const rows = reminders.length ? reminders : [{ method: "popup" as const, minutes: -1 }];
  await db
    .insertInto("calendar_event_reminder")
    .values(rows.map((r) => ({ id: crypto.randomUUID(), eventId, userId: null, method: r.method, minutesBefore: r.minutes, localOnly })))
    .execute();
}

export const FIELD_LABELS: Record<PushField, string> = {
  title: "Title",
  descriptionHtml: "Description",
  location: "Location",
  time: "Time",
  rrule: "Repeat",
  status: "Status",
  transparency: "Busy / free",
  visibility: "Visibility",
  eventType: "Event type",
  color: "Color",
  conference: "Video call",
  attendees: "Guests",
  reminders: "Reminders",
  guestPermissions: "Guest permissions",
};
