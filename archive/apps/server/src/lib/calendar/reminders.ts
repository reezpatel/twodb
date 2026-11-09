import { db } from "../../auth";
import type { CalendarReminderSpec } from "../../plugins/db";
import { logger } from "../logger";

// Reminder delivery: every tick, occurrences starting within the next week
// are checked against their reminders (personal → event → calendar default);
// a reminder fires once per (user, occurrence, offset) thanks to the unique
// delivery row. Snoozed reminders re-fire when due.

const LOOKBACK_MS = 2 * 60_000;
const HORIZON_MS = 7 * 86_400_000;

type Deliver = (userId: string, payload: Record<string, unknown>) => Promise<void>;
let deliver: Deliver = async () => {};
export function setReminderDelivery(fn: Deliver) {
  deliver = fn;
}

async function recipients(calendar: { id: string; accountId: string | null; ownerUserId: string }): Promise<string[]> {
  if (calendar.accountId) {
    const members = await db
      .selectFrom("connected_account_member")
      .select("userId")
      .where("accountId", "=", calendar.accountId)
      .where("role", "in", ["owner", "member"])
      .execute();
    return members.map((m) => m.userId);
  }
  const shares = await db
    .selectFrom("calendar_share")
    .select("principal")
    .where("calendarId", "=", calendar.id)
    .where("principalType", "=", "user")
    .where("role", "in", ["editor", "viewer"])
    .execute();
  return [calendar.ownerUserId, ...shares.map((s) => s.principal)];
}

export async function runReminders() {
  const now = Date.now();
  const occurrences = await db
    .selectFrom("calendar_occurrence as o")
    .innerJoin("calendar as c", "c.id", "o.calendarId")
    .select([
      "o.eventId",
      "o.overrideEventId",
      "o.startAt",
      "o.isAllDay",
      "o.status",
      "c.id as calendarId",
      "c.accountId",
      "c.ownerUserId",
      "c.defaultReminders",
      "c.organizationId",
      "c.name as calendarName",
    ])
    .where("o.startAt", ">", new Date(now - LOOKBACK_MS))
    .where("o.startAt", "<", new Date(now + HORIZON_MS))
    .where("o.status", "!=", "cancelled")
    .where("c.deletedAt", "is", null)
    .where("c.kind", "!=", "subscription")
    .limit(5000)
    .execute();
  if (!occurrences.length) return;

  const eventIds = [...new Set(occurrences.map((o) => o.overrideEventId ?? o.eventId))];
  const reminders = await db.selectFrom("calendar_event_reminder").selectAll().where("eventId", "in", eventIds).execute();
  const recipientCache = new Map<string, string[]>();

  for (const o of occurrences) {
    const eventId = o.overrideEventId ?? o.eventId;
    const own = reminders.filter((r) => r.eventId === eventId);
    let users = recipientCache.get(o.calendarId);
    if (!users) {
      users = await recipients({ id: o.calendarId, accountId: o.accountId, ownerUserId: o.ownerUserId });
      recipientCache.set(o.calendarId, users);
    }
    for (const userId of users) {
      const personal = own.filter((r) => r.userId === userId && r.minutesBefore >= 0);
      const eventLevel = own.filter((r) => !r.userId);
      let specs: CalendarReminderSpec[];
      if (personal.length) specs = personal.map((r) => ({ method: r.method as "popup" | "email", minutes: r.minutesBefore }));
      else if (eventLevel.length)
        specs = eventLevel.filter((r) => r.minutesBefore >= 0).map((r) => ({ method: r.method as "popup" | "email", minutes: r.minutesBefore }));
      else specs = (o.defaultReminders ?? []).filter((r) => !!r.allDay === o.isAllDay || (r.allDay === undefined && !o.isAllDay));
      for (const spec of specs) {
        const fireAt = o.startAt.getTime() - spec.minutes * 60_000;
        if (fireAt > now || fireAt < now - LOOKBACK_MS) continue;
        const inserted = await db
          .insertInto("calendar_reminder_delivery")
          .values({
            id: crypto.randomUUID(),
            userId,
            eventId,
            occurrenceStart: o.startAt,
            minutesBefore: spec.minutes,
            method: spec.method,
            firedAt: new Date(),
            dismissedAt: null,
            snoozedUntil: null,
          })
          .onConflict((oc) => oc.doNothing())
          .returning("id")
          .executeTakeFirst();
        if (!inserted) continue;
        await fire(userId, o.organizationId, eventId, o.startAt, spec, inserted.id, o.calendarName).catch((e) =>
          logger.warn({ err: e }, "calendar: reminder delivery failed"),
        );
      }
    }
  }

  const snoozed = await db
    .selectFrom("calendar_reminder_delivery")
    .selectAll()
    .where("snoozedUntil", "<=", new Date())
    .where("dismissedAt", "is", null)
    .limit(200)
    .execute();
  for (const s of snoozed) {
    await db.updateTable("calendar_reminder_delivery").set({ snoozedUntil: null }).where("id", "=", s.id).execute();
    const event = await db
      .selectFrom("calendar_event")
      .innerJoin("calendar", "calendar.id", "calendar_event.calendarId")
      .select(["calendar.organizationId", "calendar.name"])
      .where("calendar_event.id", "=", s.eventId)
      .executeTakeFirst();
    if (event) await fire(s.userId, event.organizationId, s.eventId, s.occurrenceStart, { method: "popup", minutes: s.minutesBefore }, s.id, event.name);
  }
}

async function fire(
  userId: string,
  organizationId: string,
  eventId: string,
  startAt: Date,
  spec: CalendarReminderSpec,
  deliveryId: string,
  calendarName: string,
) {
  const event = await db
    .selectFrom("calendar_event")
    .select(["title", "location", "conference", "isAllDay", "startDate"])
    .where("id", "=", eventId)
    .executeTakeFirst();
  if (!event) return;
  const declined = await db.selectFrom("calendar_event_attendee").select("status").where("eventId", "=", eventId).where("isSelf", "=", true).executeTakeFirst();
  if ((declined?.status ?? "") === "declined") return;
  const payload = {
    type: "reminder",
    deliveryId,
    eventId,
    occurrenceStart: startAt.toISOString(),
    title: event.title || "(no title)",
    location: event.location,
    conferenceUrl: event.conference?.url ?? null,
    isAllDay: event.isAllDay,
    minutes: spec.minutes,
    calendarName,
  };
  if (spec.method === "email") {
    const { sendReminderEmail } = await import("./reminder-email");
    await sendReminderEmail(userId, organizationId, payload);
    return;
  }
  const { notify } = await import("../notifications/notify");
  await notify({
    organizationId,
    type: "calendar.reminder",
    audience: { kind: "user", userId },
    title: payload.title,
    body: spec.minutes ? `Starts in ${spec.minutes} min` : "Starting now",
    urgency: "high",
    accent: "calendar",
    deepLink: `twodb://calendar/event/${eventId}`,
    groupingKey: `calendar.reminder:${deliveryId}`,
    data: { kind: "calendar.reminder", ...payload },
  }).catch((e) => logger.warn({ err: e }, "calendar: reminder notification failed"));
  await deliver(userId, payload);
}

export async function snoozeReminder(userId: string, deliveryId: string, minutes: number) {
  await db
    .updateTable("calendar_reminder_delivery")
    .set({ snoozedUntil: new Date(Date.now() + Math.max(1, Math.min(minutes, 24 * 60)) * 60_000) })
    .where("id", "=", deliveryId)
    .where("userId", "=", userId)
    .execute();
}

export async function dismissReminder(userId: string, deliveryId: string) {
  await db
    .updateTable("calendar_reminder_delivery")
    .set({ dismissedAt: new Date(), snoozedUntil: null })
    .where("id", "=", deliveryId)
    .where("userId", "=", userId)
    .execute();
}

export async function upcomingReminders(userId: string) {
  return db
    .selectFrom("calendar_reminder_delivery as d")
    .innerJoin("calendar_event as e", "e.id", "d.eventId")
    .select(["d.id", "d.eventId", "d.occurrenceStart", "d.minutesBefore", "d.firedAt", "d.snoozedUntil", "e.title", "e.location", "e.conference"])
    .where("d.userId", "=", userId)
    .where("d.dismissedAt", "is", null)
    .where("d.occurrenceStart", ">", new Date(Date.now() - 60 * 60_000))
    .orderBy("d.occurrenceStart")
    .limit(20)
    .execute();
}
