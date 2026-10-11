import { sql } from "kysely";
import { db } from "../../auth";
import { expand } from "./recurrence";
import { addDays, dateToUtcMidnight } from "./tz";
import type { EventRow } from "./types";

// calendar_occurrence is the read model for views, free/busy and reminders:
// one row per visible instance inside the calendar's window. Rebuilt for a
// series whenever its master or overrides change; the window grows on demand.

const PAST_DAYS = 2 * 366;
const FUTURE_DAYS = 2 * 366;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function defaultWindow() {
  return { from: addDays(today(), -PAST_DAYS), to: addDays(today(), FUTURE_DAYS) };
}

function toDateString(value: Date | string | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

async function windowFor(calendarId: string) {
  const cal = await db.selectFrom("calendar").select(["occurrenceFrom", "occurrenceTo"]).where("id", "=", calendarId).executeTakeFirst();
  const def = defaultWindow();
  const from = toDateString(cal?.occurrenceFrom ?? null) ?? def.from;
  const to = toDateString(cal?.occurrenceTo ?? null) ?? def.to;
  if (!cal?.occurrenceFrom || !cal.occurrenceTo)
    await db.updateTable("calendar").set({ occurrenceFrom: from, occurrenceTo: to }).where("id", "=", calendarId).execute();
  return { from: dateToUtcMidnight(from), to: dateToUtcMidnight(to) };
}

function visible(e: Pick<EventRow, "deletedAt" | "localDeletedAt" | "status">) {
  return !e.deletedAt && !e.localDeletedAt && e.status !== "cancelled";
}

function span(e: Pick<EventRow, "isAllDay" | "startAt" | "endAt" | "startDate" | "endDate">) {
  if (e.isAllDay && e.startDate) {
    const endDate = e.endDate ?? addDays(e.startDate, 1);
    return { startAt: dateToUtcMidnight(e.startDate), endAt: dateToUtcMidnight(endDate), startDate: e.startDate, endDate };
  }
  const startAt = e.startAt ?? new Date();
  return { startAt, endAt: e.endAt && e.endAt > startAt ? e.endAt : startAt, startDate: null, endDate: null };
}

/** Rebuilds occurrences for the series (or single event) that `eventId` belongs to. */
export async function rebuildOccurrences(eventId: string): Promise<void> {
  const first = await db.selectFrom("calendar_event").selectAll().where("id", "=", eventId).executeTakeFirst();
  if (!first) return;
  const master = first.recurringEventId ? await db.selectFrom("calendar_event").selectAll().where("id", "=", first.recurringEventId).executeTakeFirst() : first;
  if (!master) {
    // Orphan override (master not imported yet): show it on its own.
    await db.deleteFrom("calendar_occurrence").where("eventId", "=", first.id).execute();
    if (visible(first)) {
      const s = span(first);
      await db
        .insertInto("calendar_occurrence")
        .values({
          eventId: first.id,
          overrideEventId: null,
          calendarId: first.calendarId,
          ...s,
          isAllDay: first.isAllDay,
          status: first.status,
          transparency: first.transparency,
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
    }
    return;
  }

  await db.deleteFrom("calendar_occurrence").where("eventId", "=", master.id).execute();
  if (master.deletedAt || master.localDeletedAt) return;

  const rows: {
    eventId: string;
    overrideEventId: string | null;
    calendarId: string;
    startAt: Date;
    endAt: Date;
    startDate: string | null;
    endDate: string | null;
    isAllDay: boolean;
    status: string;
    transparency: string;
  }[] = [];

  if (!master.rrule?.length) {
    if (master.status !== "cancelled")
      rows.push({
        eventId: master.id,
        overrideEventId: null,
        calendarId: master.calendarId,
        ...span(master),
        isAllDay: master.isAllDay,
        status: master.status,
        transparency: master.transparency,
      });
  } else {
    const { from, to } = await windowFor(master.calendarId);
    const overrides = await db.selectFrom("calendar_event").selectAll().where("recurringEventId", "=", master.id).execute();
    const byOriginal = new Map<number, EventRow>();
    for (const o of overrides) {
      const key = o.originalStartAt?.getTime() ?? (o.originalStartDate ? dateToUtcMidnight(o.originalStartDate).getTime() : null);
      if (key !== null) byOriginal.set(key, o);
    }
    if (master.status !== "cancelled") {
      for (const inst of expand(master, from, to)) {
        if (byOriginal.has(inst.originalStart.getTime())) continue;
        rows.push({
          eventId: master.id,
          overrideEventId: null,
          calendarId: master.calendarId,
          startAt: inst.startAt,
          endAt: inst.endAt,
          startDate: inst.startDate,
          endDate: inst.endDate,
          isAllDay: master.isAllDay,
          status: master.status,
          transparency: master.transparency,
        });
      }
    }
    for (const o of overrides) {
      if (!visible(o)) continue;
      rows.push({
        eventId: master.id,
        overrideEventId: o.id,
        calendarId: master.calendarId,
        ...span(o),
        isAllDay: o.isAllDay,
        status: o.status,
        transparency: o.transparency,
      });
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    await db
      .insertInto("calendar_occurrence")
      .values(rows.slice(i, i + 500))
      .onConflict((oc) => oc.doNothing())
      .execute();
  }
}

/** Grows a calendar's window to cover [from, to) and re-expands its series. */
export async function ensureWindow(calendarIds: string[], from: Date, to: Date): Promise<void> {
  if (!calendarIds.length) return;
  const cals = await db.selectFrom("calendar").select(["id", "occurrenceFrom", "occurrenceTo"]).where("id", "in", calendarIds).execute();
  for (const cal of cals) {
    const curFrom = toDateString(cal.occurrenceFrom);
    const curTo = toDateString(cal.occurrenceTo);
    const wantFrom = addDays(from.toISOString().slice(0, 10), -31);
    const wantTo = addDays(to.toISOString().slice(0, 10), 31);
    const nextFrom = !curFrom || wantFrom < curFrom ? wantFrom : curFrom;
    const nextTo = !curTo || wantTo > curTo ? wantTo : curTo;
    if (nextFrom === curFrom && nextTo === curTo) continue;
    await db.updateTable("calendar").set({ occurrenceFrom: nextFrom, occurrenceTo: nextTo }).where("id", "=", cal.id).execute();
    const masters = await db
      .selectFrom("calendar_event")
      .select("id")
      .where("calendarId", "=", cal.id)
      .where("rrule", "is not", null)
      .where("recurringEventId", "is", null)
      .where("deletedAt", "is", null)
      .execute();
    for (const m of masters) await rebuildOccurrences(m.id);
  }
}

/** Nightly: keeps every window at least ±2 years around today. */
export async function slideWindows(): Promise<void> {
  const def = defaultWindow();
  const stale = await db
    .selectFrom("calendar")
    .select("id")
    .where("deletedAt", "is", null)
    .where(sql<boolean>`"occurrenceTo" < ${def.to}::date - interval '30 days'`)
    .execute();
  await ensureWindow(
    stale.map((s) => s.id),
    dateToUtcMidnight(def.from),
    dateToUtcMidnight(def.to),
  );
}
