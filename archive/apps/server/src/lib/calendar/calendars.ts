import { createHash, randomBytes } from "node:crypto";
import { db } from "../../auth";
import type { CalendarReminderSpec } from "../../plugins/db";
import { accessibleAccounts } from "../email/access";
import { accessibleCalendars, requireCalendar } from "./access";
import { parseIcs, serializeIcs, type SerializableEvent } from "./ical";
import { rebuildOccurrences } from "./occurrences";
import { loadAttendees } from "./snapshot";
import { isValidTimeZone } from "./tz";
import { CalendarAccessError, type NormalizedEvent } from "./types";
import { replaceAttendees } from "./events";

// twodb calendars (local, shareable inside the org), per-user overlays,
// ICS subscriptions (read-only twodb calendars), .ics import/export, the
// private feed and per-user calendar settings.

const HEX = /^#[0-9a-f]{6}$/i;

export const HOLIDAY_PRESETS: { id: string; label: string; url: string }[] = [
  { id: "us", label: "United States", url: "https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics" },
  { id: "uk", label: "United Kingdom", url: "https://calendar.google.com/calendar/ical/en.uk%23holiday%40group.v.calendar.google.com/public/basic.ics" },
  { id: "in", label: "India", url: "https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics" },
  { id: "de", label: "Germany", url: "https://calendar.google.com/calendar/ical/en.german%23holiday%40group.v.calendar.google.com/public/basic.ics" },
  { id: "fr", label: "France", url: "https://calendar.google.com/calendar/ical/en.french%23holiday%40group.v.calendar.google.com/public/basic.ics" },
  { id: "ca", label: "Canada", url: "https://calendar.google.com/calendar/ical/en.canadian%23holiday%40group.v.calendar.google.com/public/basic.ics" },
  { id: "au", label: "Australia", url: "https://calendar.google.com/calendar/ical/en.australian%23holiday%40group.v.calendar.google.com/public/basic.ics" },
  { id: "jp", label: "Japan", url: "https://calendar.google.com/calendar/ical/en.japanese%23holiday%40group.v.calendar.google.com/public/basic.ics" },
];

export interface CalendarPayload {
  id: string;
  accountId: string | null;
  accountAddress: string | null;
  name: string;
  description: string | null;
  color: string;
  timezone: string;
  kind: string;
  accessRole: string;
  role: string;
  canApprove: boolean;
  isPrimary: boolean;
  syncEnabled: boolean;
  hidden: boolean;
  sortOrder: number;
  defaultReminders: CalendarReminderSpec[];
  allowedConference: string[];
  subscriptionUrl: string | null;
  hasFeed: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  ownerUserId: string;
}

export async function listCalendars(organizationId: string, userId: string): Promise<CalendarPayload[]> {
  const access = await accessibleCalendars(organizationId, userId);
  if (!access.length) return [];
  const prefs = await db
    .selectFrom("calendar_user_pref")
    .selectAll()
    .where("userId", "=", userId)
    .where(
      "calendarId",
      "in",
      access.map((a) => a.calendar.id),
    )
    .execute();
  const accountIds = [...new Set(access.map((a) => a.calendar.accountId).filter((v): v is string => !!v))];
  const accounts = accountIds.length
    ? await db.selectFrom("connected_account").select(["id", "address", "capabilities"]).where("id", "in", accountIds).execute()
    : [];
  return access
    .filter((a) => !a.calendar.accountId || accounts.find((x) => x.id === a.calendar.accountId)?.capabilities.includes("calendar"))
    .map(({ calendar: c, role, canApprove }) => {
      const pref = prefs.find((p) => p.calendarId === c.id);
      return {
        id: c.id,
        accountId: c.accountId,
        accountAddress: accounts.find((x) => x.id === c.accountId)?.address ?? null,
        name: pref?.name || c.name,
        description: c.description,
        color: pref?.color || c.color,
        timezone: c.timezone,
        kind: c.kind,
        accessRole: c.accessRole,
        role,
        canApprove,
        isPrimary: c.isPrimary,
        syncEnabled: c.syncEnabled,
        hidden: pref?.hidden ?? false,
        sortOrder: pref?.sortOrder ?? (c.isPrimary ? -1 : 0),
        defaultReminders: c.defaultReminders,
        allowedConference: c.allowedConference,
        subscriptionUrl: c.ownerUserId === userId ? c.subscriptionUrl : null,
        hasFeed: !!c.feedTokenHash,
        lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
        lastError: c.lastError,
        ownerUserId: c.ownerUserId,
      };
    })
    .sort(
      (a, b) =>
        Number(!!a.accountId) - Number(!!b.accountId) ||
        (a.accountAddress ?? "").localeCompare(b.accountAddress ?? "") ||
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name),
    );
}

export async function createLocalCalendar(
  organizationId: string,
  userId: string,
  body: { name?: unknown; color?: unknown; timezone?: unknown; description?: unknown; subscriptionUrl?: unknown },
) {
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (!name) throw new CalendarAccessError(400, "name_required");
  const color = typeof body.color === "string" && HEX.test(body.color) ? body.color : "#4f7cff";
  const timezone = typeof body.timezone === "string" && isValidTimeZone(body.timezone) ? body.timezone : "UTC";
  let subscriptionUrl: string | null = null;
  if (typeof body.subscriptionUrl === "string" && body.subscriptionUrl.trim()) {
    const url = body.subscriptionUrl.trim().replace(/^webcal:\/\//i, "https://");
    if (!/^https?:\/\//i.test(url)) throw new CalendarAccessError(400, "invalid_url");
    subscriptionUrl = url;
  }
  const id = crypto.randomUUID();
  const now = new Date();
  await db
    .insertInto("calendar")
    .values({
      id,
      organizationId,
      accountId: null,
      ownerUserId: userId,
      providerCalendarId: null,
      name,
      description: typeof body.description === "string" ? body.description.slice(0, 2000) : null,
      color,
      timezone,
      kind: subscriptionUrl ? "subscription" : "regular",
      subscriptionUrl,
      accessRole: subscriptionUrl ? "reader" : "owner",
      defaultReminders: JSON.stringify(subscriptionUrl ? [] : [{ method: "popup", minutes: 10 }]),
      syncCursor: null,
      ctag: null,
      lastSyncedAt: null,
      lastError: null,
      feedTokenHash: null,
      providerData: "{}",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    .execute();
  if (subscriptionUrl)
    await syncSubscription(id).catch(async (e) => {
      await db
        .updateTable("calendar")
        .set({ lastError: (e as Error).message })
        .where("id", "=", id)
        .execute();
    });
  return id;
}

/** Ensures every user has at least one twodb calendar to create events in. */
export async function ensureDefaultCalendar(organizationId: string, userId: string) {
  const existing = await db
    .selectFrom("calendar")
    .select("id")
    .where("organizationId", "=", organizationId)
    .where("ownerUserId", "=", userId)
    .where("accountId", "is", null)
    .where("kind", "!=", "subscription")
    .limit(1)
    .executeTakeFirst();
  if (existing) return existing.id;
  const user = await db.selectFrom("user").select("name").where("id", "=", userId).executeTakeFirst();
  const id = await createLocalCalendar(organizationId, userId, {
    name: user?.name ? `${user.name.split(" ")[0]}'s calendar` : "My calendar",
    color: "#4f7cff",
  });
  await db.updateTable("calendar").set({ isPrimary: true, kind: "default" }).where("id", "=", id).execute();
  return id;
}

export async function updateCalendar(organizationId: string, userId: string, calendarId: string, body: Record<string, unknown>) {
  const { calendar, role } = await requireCalendar(organizationId, userId, calendarId, "viewer");
  const now = new Date();
  // Per-user overlay — always allowed, never pushed.
  const pref: Record<string, unknown> = {};
  if (typeof body.hidden === "boolean") pref.hidden = body.hidden;
  if (typeof body.sortOrder === "number") pref.sortOrder = Math.round(body.sortOrder);
  if (body.colorOverride === null || (typeof body.colorOverride === "string" && HEX.test(body.colorOverride))) pref.color = body.colorOverride;
  if (body.nameOverride === null || typeof body.nameOverride === "string") pref.name = (body.nameOverride as string | null)?.trim() || null;
  if (Object.keys(pref).length) {
    await db
      .insertInto("calendar_user_pref")
      .values({ userId, calendarId, notify: "{}", updatedAt: now, ...pref })
      .onConflict((oc) => oc.columns(["userId", "calendarId"]).doUpdateSet({ ...pref, updatedAt: now }))
      .execute();
  }
  const cols: Record<string, unknown> = {};
  if (role === "owner" && !calendar.accountId) {
    if (typeof body.name === "string" && body.name.trim()) cols.name = body.name.trim().slice(0, 200);
    if (typeof body.color === "string" && HEX.test(body.color)) cols.color = body.color;
    if (typeof body.description === "string") cols.description = body.description.slice(0, 2000) || null;
    if (typeof body.timezone === "string" && isValidTimeZone(body.timezone)) cols.timezone = body.timezone;
    if (body.isPrimary === true) {
      await db.updateTable("calendar").set({ isPrimary: false }).where("ownerUserId", "=", userId).where("accountId", "is", null).execute();
      cols.isPrimary = true;
    }
  }
  if (roleIsOwnerish(role)) {
    if (Array.isArray(body.defaultReminders)) {
      cols.defaultReminders = JSON.stringify(
        body.defaultReminders
          .map((r) => r as CalendarReminderSpec)
          .filter((r) => typeof r.minutes === "number" && r.minutes >= 0 && r.minutes <= 40320)
          .slice(0, 5)
          .map((r) => ({ method: r.method === "email" ? "email" : "popup", minutes: Math.round(r.minutes), allDay: !!r.allDay })),
      );
    }
    if (typeof body.syncEnabled === "boolean" && calendar.accountId) cols.syncEnabled = body.syncEnabled;
  }
  if (Object.keys(cols).length)
    await db
      .updateTable("calendar")
      .set({ ...cols, updatedAt: now })
      .where("id", "=", calendarId)
      .execute();
}

function roleIsOwnerish(role: string) {
  return role === "owner" || role === "editor";
}

export async function deleteLocalCalendar(organizationId: string, userId: string, calendarId: string) {
  const { calendar, role } = await requireCalendar(organizationId, userId, calendarId, "viewer");
  if (calendar.accountId) throw new CalendarAccessError(400, "provider_calendar_cannot_be_deleted");
  if (role !== "owner") throw new CalendarAccessError(403, "forbidden");
  await db.updateTable("calendar").set({ deletedAt: new Date(), updatedAt: new Date() }).where("id", "=", calendarId).execute();
  await db.deleteFrom("calendar_occurrence").where("calendarId", "=", calendarId).execute();
}

// ── sharing (twodb calendars) ────────────────────────────────────────────────

export async function listShares(organizationId: string, userId: string, calendarId: string) {
  await requireCalendar(organizationId, userId, calendarId, "viewer");
  return db
    .selectFrom("calendar_share")
    .leftJoin("user", (j) => j.on("calendar_share.principalType", "=", "user").onRef("user.id", "=", "calendar_share.principal"))
    .select(["calendar_share.id", "calendar_share.principalType", "calendar_share.principal", "calendar_share.role", "user.name", "user.email"])
    .where("calendar_share.calendarId", "=", calendarId)
    .orderBy("calendar_share.createdAt")
    .execute();
}

export async function setShare(
  organizationId: string,
  userId: string,
  calendarId: string,
  body: { principalType?: unknown; principal?: unknown; role?: unknown },
) {
  const { calendar, role } = await requireCalendar(organizationId, userId, calendarId, "viewer");
  if (calendar.accountId) throw new CalendarAccessError(400, "share_the_account_instead");
  if (role !== "owner") throw new CalendarAccessError(403, "forbidden");
  const principalType = body.principalType === "org" ? "org" : "user";
  const principal = principalType === "org" ? organizationId : String(body.principal ?? "");
  const shareRole = ["editor", "viewer", "free_busy"].includes(String(body.role)) ? String(body.role) : "viewer";
  if (principalType === "user") {
    if (principal === calendar.ownerUserId) throw new CalendarAccessError(400, "owner_role_fixed");
    const member = await db.selectFrom("member").select("id").where("organizationId", "=", organizationId).where("userId", "=", principal).executeTakeFirst();
    if (!member) throw new CalendarAccessError(404, "user_not_in_organization");
  }
  await db
    .insertInto("calendar_share")
    .values({ id: crypto.randomUUID(), organizationId, calendarId, principalType, principal, role: shareRole, providerRuleId: null, createdAt: new Date() })
    .onConflict((oc) => oc.columns(["calendarId", "principalType", "principal"]).doUpdateSet({ role: shareRole }))
    .execute();
}

export async function removeShare(organizationId: string, userId: string, calendarId: string, shareId: string) {
  const { role } = await requireCalendar(organizationId, userId, calendarId, "viewer");
  const share = await db.selectFrom("calendar_share").selectAll().where("id", "=", shareId).where("calendarId", "=", calendarId).executeTakeFirst();
  if (!share) return;
  if (role !== "owner" && !(share.principalType === "user" && share.principal === userId)) throw new CalendarAccessError(403, "forbidden");
  await db.deleteFrom("calendar_share").where("id", "=", shareId).execute();
}

// ── private ICS feed ─────────────────────────────────────────────────────────

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function rotateFeed(organizationId: string, userId: string, calendarId: string, enable: boolean): Promise<string | null> {
  const { role } = await requireCalendar(organizationId, userId, calendarId, "viewer");
  if (role !== "owner") throw new CalendarAccessError(403, "forbidden");
  if (!enable) {
    await db.updateTable("calendar").set({ feedTokenHash: null }).where("id", "=", calendarId).execute();
    return null;
  }
  const token = randomBytes(24).toString("base64url");
  await db
    .updateTable("calendar")
    .set({ feedTokenHash: hashToken(token) })
    .where("id", "=", calendarId)
    .execute();
  return token;
}

async function serializableEvents(calendarId: string, opts: { from?: Date; to?: Date } = {}): Promise<SerializableEvent[]> {
  let q = db.selectFrom("calendar_event").selectAll().where("calendarId", "=", calendarId).where("deletedAt", "is", null).where("localDeletedAt", "is", null);
  if (opts.from)
    q = q.where((eb) =>
      eb.or([
        eb("rrule", "is not", null),
        eb("endAt", ">=", opts.from!),
        eb("endDate", ">=", opts.from!.toISOString().slice(0, 10)),
        eb("recurringEventId", "is not", null),
      ]),
    );
  if (opts.to) q = q.where((eb) => eb.or([eb("startAt", "<", opts.to!), eb("startDate", "<", opts.to!.toISOString().slice(0, 10))]));
  const rows = await q.limit(20000).execute();
  const out: SerializableEvent[] = [];
  for (const e of rows) {
    const attendees = await loadAttendees(e.id);
    out.push({ ...e, rrule: e.recurringEventId ? null : e.rrule, attendees, organizer: e.organizer, conference: e.conference, reminders: null });
  }
  return out;
}

export async function feedIcs(token: string): Promise<string | null> {
  const calendar = await db
    .selectFrom("calendar")
    .select(["id", "name"])
    .where("feedTokenHash", "=", hashToken(token))
    .where("deletedAt", "is", null)
    .executeTakeFirst();
  if (!calendar) return null;
  return serializeIcs(await serializableEvents(calendar.id), { name: calendar.name });
}

export async function exportCalendarIcs(organizationId: string, userId: string, calendarId: string, from?: Date, to?: Date) {
  const { calendar } = await requireCalendar(organizationId, userId, calendarId, "viewer");
  return { name: calendar.name, ics: serializeIcs(await serializableEvents(calendarId, { from, to }), { name: calendar.name }) };
}

export async function exportEventIcs(eventId: string) {
  const e = await db.selectFrom("calendar_event").selectAll().where("id", "=", eventId).executeTakeFirstOrThrow();
  const overrides = e.rrule?.length
    ? await db.selectFrom("calendar_event").selectAll().where("recurringEventId", "=", e.id).where("deletedAt", "is", null).execute()
    : [];
  const events: SerializableEvent[] = [];
  for (const row of [e, ...overrides])
    events.push({ ...row, rrule: row.recurringEventId ? null : row.rrule, attendees: await loadAttendees(row.id), reminders: null });
  return serializeIcs(events, { method: "PUBLISH" });
}

// ── .ics import + subscriptions ──────────────────────────────────────────────

async function upsertIcsEvents(
  calendarId: string,
  organizationId: string,
  events: NormalizedEvent[],
  source: "ics_import" | "provider",
  replace: boolean,
): Promise<number> {
  const now = new Date();
  const masters = new Map<string, string>();
  const seen = new Set<string>();
  const ordered = [...events].sort((a, b) => Number(!!a.recurringProviderEventId) - Number(!!b.recurringProviderEventId));
  let count = 0;
  for (const ne of ordered) {
    const key = ne.providerEventId;
    seen.add(key);
    const masterId = ne.recurringProviderEventId ? (masters.get(ne.recurringProviderEventId) ?? null) : null;
    const existing = await db
      .selectFrom("calendar_event")
      .select(["id"])
      .where("calendarId", "=", calendarId)
      .where("providerEventId", "=", key)
      .executeTakeFirst();
    const cols = {
      uid: ne.uid,
      sequence: ne.sequence ?? 0,
      status: ne.status,
      title: ne.title,
      descriptionHtml: ne.descriptionHtml ?? null,
      location: ne.location ?? null,
      isAllDay: ne.isAllDay,
      startAt: ne.startAt ?? null,
      endAt: ne.endAt ?? null,
      startDate: ne.startDate ?? null,
      endDate: ne.endDate ?? null,
      startTz: ne.startTz ?? null,
      endTz: ne.endTz ?? null,
      isFloating: !!ne.isFloating,
      rrule: ne.rrule ?? null,
      transparency: ne.transparency ?? "opaque",
      visibility: ne.visibility ?? "default",
      organizer: JSON.stringify(ne.organizer ?? null),
      conference: JSON.stringify(ne.conference ?? null),
      recurringEventId: masterId,
      originalStartAt: ne.originalStartAt ?? null,
      originalStartDate: ne.originalStartDate ?? null,
      deletedAt: null,
      deletedSource: null,
      updatedAt: now,
    };
    let id = existing?.id;
    if (id) await db.updateTable("calendar_event").set(cols).where("id", "=", id).execute();
    else {
      id = crypto.randomUUID();
      await db
        .insertInto("calendar_event")
        .values({
          id,
          organizationId,
          calendarId,
          providerEventId: key,
          etag: null,
          geo: JSON.stringify(null),
          color: null,
          eventTypeProps: "{}",
          meetingRecordingId: null,
          rawIcs: null,
          providerData: "{}",
          providerUpdatedAt: null,
          localOnlyFields: "{}",
          localDeletedAt: null,
          createdByUserId: null,
          source,
          createdAt: now,
          ...cols,
        })
        .execute();
    }
    await replaceAttendees(id, ne.attendees);
    if (!ne.recurringProviderEventId) masters.set(key, id);
    count++;
  }
  if (replace) {
    const stale = await db
      .selectFrom("calendar_event")
      .select(["id", "providerEventId"])
      .where("calendarId", "=", calendarId)
      .where("deletedAt", "is", null)
      .execute();
    const gone = stale.filter((s) => s.providerEventId && !seen.has(s.providerEventId)).map((s) => s.id);
    if (gone.length) await db.updateTable("calendar_event").set({ deletedAt: now, deletedSource: "provider" }).where("id", "in", gone).execute();
  }
  const roots = await db
    .selectFrom("calendar_event")
    .select("id")
    .where("calendarId", "=", calendarId)
    .where("recurringEventId", "is", null)
    .where("updatedAt", ">=", now)
    .execute();
  for (const r of roots) await rebuildOccurrences(r.id);
  if (replace) {
    const deleted = await db.selectFrom("calendar_event").select("id").where("calendarId", "=", calendarId).where("deletedAt", ">=", now).execute();
    for (const d of deleted) await rebuildOccurrences(d.id);
  }
  return count;
}

/** One-off import into a twodb calendar (uid-keyed, so re-importing the same file updates instead of duplicating). */
export async function importIcsFile(organizationId: string, userId: string, calendarId: string, text: string): Promise<number> {
  const { calendar } = await requireCalendar(organizationId, userId, calendarId, "editor");
  if (calendar.accountId) throw new CalendarAccessError(400, "import_into_twodb_calendar");
  let parsed;
  try {
    parsed = parseIcs(text);
  } catch {
    throw new CalendarAccessError(400, "invalid_ics");
  }
  return upsertIcsEvents(calendarId, organizationId, parsed.events, "ics_import", false);
}

export async function syncSubscription(calendarId: string): Promise<number> {
  const calendar = await db.selectFrom("calendar").selectAll().where("id", "=", calendarId).executeTakeFirstOrThrow();
  if (!calendar.subscriptionUrl) return 0;
  const res = await fetch(calendar.subscriptionUrl, {
    headers: { accept: "text/calendar", ...(calendar.ctag ? { "if-none-match": calendar.ctag } : {}) },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 304) {
    await db.updateTable("calendar").set({ lastSyncedAt: new Date(), lastError: null }).where("id", "=", calendarId).execute();
    return 0;
  }
  if (!res.ok) throw new Error(`subscription_fetch_failed: ${res.status}`);
  const text = await res.text();
  if (text.length > 20 * 1024 * 1024) throw new Error("subscription_too_large");
  const parsed = parseIcs(text);
  const n = await upsertIcsEvents(calendarId, calendar.organizationId, parsed.events, "provider", true);
  await db
    .updateTable("calendar")
    .set({
      ctag: res.headers.get("etag"),
      lastSyncedAt: new Date(),
      lastError: null,
      ...(parsed.calendarName && calendar.name === "Subscription" ? { name: parsed.calendarName } : {}),
    })
    .where("id", "=", calendarId)
    .execute();
  return n;
}

// ── user settings ────────────────────────────────────────────────────────────

export interface CalendarSettings {
  timezone: string;
  secondaryTimezone: string | null;
  weekStart: 0 | 1 | 6;
  defaultView: "day" | "week" | "month" | "agenda" | "year" | "4day";
  defaultDurationMin: number;
  speedyMeetings: boolean;
  showWeekends: boolean;
  showDeclined: boolean;
  showWeekNumbers: boolean;
  dimPast: boolean;
  workingHours: { day: number; start: string; end: string; location?: string | null }[];
  autoAddInvites: "always" | "responded" | "never";
  defaultCalendarId: string | null;
  dailyAgendaEmail: boolean;
  desktopNotifications: boolean;
}

export const DEFAULT_SETTINGS: CalendarSettings = {
  // Empty = follow the browser's time zone.
  timezone: "",
  secondaryTimezone: null,
  weekStart: 1,
  defaultView: "week",
  defaultDurationMin: 30,
  speedyMeetings: false,
  showWeekends: true,
  showDeclined: false,
  showWeekNumbers: false,
  dimPast: true,
  workingHours: [1, 2, 3, 4, 5].map((day) => ({ day, start: "09:00", end: "17:00", location: null })),
  autoAddInvites: "always",
  defaultCalendarId: null,
  dailyAgendaEmail: false,
  desktopNotifications: true,
};

export async function getSettings(organizationId: string, userId: string): Promise<CalendarSettings> {
  const row = await db
    .selectFrom("calendar_user_settings")
    .select("settings")
    .where("userId", "=", userId)
    .where("organizationId", "=", organizationId)
    .executeTakeFirst();
  return { ...DEFAULT_SETTINGS, ...((row?.settings as Partial<CalendarSettings>) ?? {}) };
}

export async function saveSettings(organizationId: string, userId: string, patch: Partial<CalendarSettings>): Promise<CalendarSettings> {
  const current = await getSettings(organizationId, userId);
  const next: CalendarSettings = { ...current };
  if (typeof patch.timezone === "string" && (patch.timezone === "" || isValidTimeZone(patch.timezone))) next.timezone = patch.timezone;
  if (patch.secondaryTimezone === null || (typeof patch.secondaryTimezone === "string" && isValidTimeZone(patch.secondaryTimezone)))
    next.secondaryTimezone = patch.secondaryTimezone;
  if (patch.weekStart === 0 || patch.weekStart === 1 || patch.weekStart === 6) next.weekStart = patch.weekStart;
  if (patch.defaultView && ["day", "week", "month", "agenda", "year", "4day"].includes(patch.defaultView)) next.defaultView = patch.defaultView;
  if (typeof patch.defaultDurationMin === "number") next.defaultDurationMin = Math.max(5, Math.min(480, Math.round(patch.defaultDurationMin)));
  for (const k of ["speedyMeetings", "showWeekends", "showDeclined", "showWeekNumbers", "dimPast", "dailyAgendaEmail", "desktopNotifications"] as const) {
    if (typeof patch[k] === "boolean") next[k] = patch[k];
  }
  if (Array.isArray(patch.workingHours)) {
    next.workingHours = patch.workingHours
      .filter((w) => w && w.day >= 0 && w.day <= 6 && /^\d{2}:\d{2}$/.test(w.start) && /^\d{2}:\d{2}$/.test(w.end) && w.start < w.end)
      .map((w) => ({ day: w.day, start: w.start, end: w.end, location: w.location ?? null }));
  }
  if (patch.autoAddInvites && ["always", "responded", "never"].includes(patch.autoAddInvites)) next.autoAddInvites = patch.autoAddInvites;
  if (patch.defaultCalendarId === null || typeof patch.defaultCalendarId === "string") next.defaultCalendarId = patch.defaultCalendarId;
  await db
    .insertInto("calendar_user_settings")
    .values({ userId, organizationId, settings: JSON.stringify(next), updatedAt: new Date() })
    .onConflict((oc) => oc.columns(["userId", "organizationId"]).doUpdateSet({ settings: JSON.stringify(next), updatedAt: new Date() }))
    .execute();
  return next;
}

/** Account → calendars map used by the settings UI. */
export async function calendarAccounts(organizationId: string, userId: string) {
  const roles = await accessibleAccounts(organizationId, userId);
  if (!roles.size) return [];
  return db
    .selectFrom("connected_account")
    .select([
      "id",
      "address",
      "kind",
      "capabilities",
      "calendarState",
      "calendarError",
      "calendarImportState",
      "calendarImportProgress",
      "calendarLastSyncedAt",
      "syncMode",
    ])
    .where("id", "in", [...roles.keys()])
    .where("deletedAt", "is", null)
    .execute();
}
