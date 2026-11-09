import { sql } from "kysely";
import { db } from "../../auth";
import { resolveBook } from "../contacts/contacts";
import { normalizeEmail } from "../contacts/learn";
import { requireCalendar } from "./access";
import { getSettings } from "./calendars";
import { calendarConnectorFor } from "./connectors/registry";
import { ensureWindow } from "./occurrences";
import { calendarCtx } from "./sync";
import { wallFromUtc, utcFromWall } from "./tz";
import { CalendarAccessError } from "./types";

// Free/busy for find-a-time. Busy blocks only — never titles. Org members
// come from their own local occurrences; everyone else from the calendar
// account's provider (Google freeBusy / Graph getSchedule). Attendees must be
// people the calendar's contact book knows (or org members), so this can't be
// used to probe arbitrary addresses through another account.

export interface Busy {
  start: string;
  end: string;
}

async function localBusy(organizationId: string, userIds: string[], from: Date, to: Date): Promise<Map<string, Busy[]>> {
  const out = new Map<string, Busy[]>();
  if (!userIds.length) return out;
  const calendars = await db
    .selectFrom("calendar")
    .leftJoin("connected_account_member", (j) =>
      j.onRef("connected_account_member.accountId", "=", "calendar.accountId").on("connected_account_member.role", "=", "owner"),
    )
    .select(["calendar.id", "calendar.ownerUserId", "connected_account_member.userId as accountOwner"])
    .where("calendar.organizationId", "=", organizationId)
    .where("calendar.deletedAt", "is", null)
    .where("calendar.kind", "not in", ["subscription", "holiday", "birthdays"])
    .where("calendar.accessRole", "=", "owner")
    .where((eb) => eb.or([eb("calendar.ownerUserId", "in", userIds), eb("connected_account_member.userId", "in", userIds)]))
    .execute();
  if (!calendars.length) return out;
  await ensureWindow(
    calendars.map((c) => c.id),
    from,
    to,
  );
  const rows = await db
    .selectFrom("calendar_occurrence as o")
    .select(["o.calendarId", "o.startAt", "o.endAt", "o.eventId", "o.overrideEventId"])
    .where(
      "o.calendarId",
      "in",
      calendars.map((c) => c.id),
    )
    .where("o.transparency", "=", "opaque")
    .where("o.status", "!=", "cancelled")
    .where("o.startAt", "<", to)
    .where("o.endAt", ">", from)
    .where(
      sql<boolean>`not exists (select 1 from calendar_event_attendee a where a."eventId" = coalesce(o."overrideEventId", o."eventId") and a."isSelf" and a.status = 'declined')`,
    )
    .execute();
  for (const r of rows) {
    const cal = calendars.find((c) => c.id === r.calendarId)!;
    const owner = cal.accountOwner ?? cal.ownerUserId;
    const list = out.get(owner) ?? [];
    list.push({ start: r.startAt.toISOString(), end: r.endAt.toISOString() });
    out.set(owner, list);
  }
  return out;
}

function merge(blocks: Busy[]): Busy[] {
  const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start));
  const out: Busy[] = [];
  for (const b of sorted) {
    const last = out.at(-1);
    if (last && b.start <= last.end) last.end = b.end > last.end ? b.end : last.end;
    else out.push({ ...b });
  }
  return out;
}

export async function freeBusy(organizationId: string, userId: string, calendarId: string, attendees: string[], from: Date, to: Date) {
  if (to.getTime() - from.getTime() > 62 * 86_400_000) throw new CalendarAccessError(400, "range_too_large");
  const { calendar } = await requireCalendar(organizationId, userId, calendarId, "editor");
  const emails = [...new Set(attendees.map((a) => normalizeEmail(a)).filter((e): e is string => !!e))].slice(0, 30);
  const me = await db.selectFrom("user").select(["id", "email"]).where("id", "=", userId).executeTakeFirstOrThrow();
  const members = await db
    .selectFrom("member")
    .innerJoin("user", "user.id", "member.userId")
    .select(["user.id", "user.email"])
    .where("member.organizationId", "=", organizationId)
    .where(sql`lower("user".email)`, "in", [...emails, me.email.toLowerCase()])
    .execute();
  const memberByEmail = new Map(members.map((m) => [m.email.toLowerCase(), m.id]));
  const accountAddresses = calendar.accountId
    ? [(await db.selectFrom("connected_account").select("address").where("id", "=", calendar.accountId).executeTakeFirstOrThrow()).address.toLowerCase()]
    : [];
  const { book } = await resolveBook(organizationId, userId, { calendarId });
  const known = new Set(
    (
      await db
        .selectFrom("contact")
        .select("email")
        .where("bookId", "=", book.id)
        .where("email", "in", emails.length ? emails : ["__none__"])
        .where("forgottenAt", "is", null)
        .execute()
    ).map((c) => c.email),
  );
  const external = emails.filter((e) => !memberByEmail.has(e) && !accountAddresses.includes(e));
  const unknown = external.filter((e) => !known.has(e));
  if (unknown.length) throw new CalendarAccessError(403, `not_in_contacts: ${unknown.join(", ")}`);

  const result: Record<string, { busy: Busy[]; source: "twodb" | "provider" | "unavailable" }> = {};
  const local = await localBusy(organizationId, [...new Set([userId, ...emails.map((e) => memberByEmail.get(e)).filter((v): v is string => !!v)])], from, to);
  result[me.email.toLowerCase()] = { busy: merge(local.get(userId) ?? []), source: "twodb" };
  for (const e of accountAddresses) result[e] = result[me.email.toLowerCase()];
  for (const e of emails) {
    const uid = memberByEmail.get(e);
    if (uid) result[e] = { busy: merge(local.get(uid) ?? []), source: "twodb" };
  }
  if (external.length && calendar.accountId) {
    const account = await db.selectFrom("connected_account").selectAll().where("id", "=", calendar.accountId).executeTakeFirstOrThrow();
    const connector = calendarConnectorFor(account.kind);
    const remote = connector.freeBusy ? await connector.freeBusy(calendarCtx(account), external, from, to).catch(() => ({})) : {};
    for (const e of external) {
      const blocks = (remote as Record<string, { start: Date; end: Date }[]>)[e];
      result[e] = blocks
        ? { busy: merge(blocks.map((b) => ({ start: b.start.toISOString(), end: b.end.toISOString() }))), source: "provider" }
        : { busy: [], source: "unavailable" };
    }
  } else for (const e of external) result[e] = { busy: [], source: "unavailable" };
  return result;
}

/** Suggests slots where every attendee with known availability is free, inside the user's working hours. */
export async function suggestTimes(organizationId: string, userId: string, calendarId: string, attendees: string[], durationMin: number, from: Date, to: Date) {
  const busy = await freeBusy(organizationId, userId, calendarId, attendees, from, to);
  const settings = await getSettings(organizationId, userId);
  const tz = settings.timezone || "UTC";
  const blocks = Object.values(busy).flatMap((b) => b.busy.map((x) => ({ start: new Date(x.start).getTime(), end: new Date(x.end).getTime() })));
  const step = 15 * 60_000;
  const duration = Math.max(15, Math.min(durationMin, 480)) * 60_000;
  const slots: { start: string; end: string }[] = [];
  let t = Math.ceil(Math.max(from.getTime(), Date.now()) / step) * step;
  while (t + duration <= to.getTime() && slots.length < 12) {
    const wall = wallFromUtc(new Date(t), tz);
    const hours = settings.workingHours.find((w) => w.day === wall.getUTCDay());
    if (hours) {
      const [sh, sm] = hours.start.split(":").map(Number);
      const [eh, em] = hours.end.split(":").map(Number);
      const dayStart = utcFromWall(new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate(), sh, sm)), tz).getTime();
      const dayEnd = utcFromWall(new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate(), eh, em)), tz).getTime();
      if (t >= dayStart && t + duration <= dayEnd && !blocks.some((b) => b.start < t + duration && b.end > t)) {
        slots.push({ start: new Date(t).toISOString(), end: new Date(t + duration).toISOString() });
        t += Math.max(duration, 30 * 60_000);
        continue;
      }
    }
    t += step;
  }
  return { busy, slots };
}
