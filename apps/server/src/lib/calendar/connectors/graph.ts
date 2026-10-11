import { providerFetch, ProviderHttpError } from "../../accounts/provider-http";
import { expand } from "../recurrence";
import { safeTz, WINDOWS_TZ } from "../tz";
import {
  PreconditionFailedError,
  SyncTokenExpiredError,
  type CalendarConnector,
  type CalendarCtx,
  type CalendarRow,
  type EventWrite,
  type NormalizedAttendee,
  type NormalizedCalendar,
  type NormalizedEvent,
} from "../types";

// Microsoft Graph calendar. Change detection uses calendarView/delta over the
// import window, which yields single events, exceptions and plain
// occurrences — never series masters — so masters are refetched (with their
// instances, to derive cancelled dates as EXDATEs) whenever a series changes.

const API = "https://graph.microsoft.com/v1.0/me";
const UTC_PREFER = 'outlook.timezone="UTC"';

const RESPONSE_IN: Record<string, string> = {
  none: "needs_action",
  notResponded: "needs_action",
  organizer: "accepted",
  accepted: "accepted",
  declined: "declined",
  tentativelyAccepted: "tentative",
};
const DAY_CODES: Record<string, string> = { sunday: "SU", monday: "MO", tuesday: "TU", wednesday: "WE", thursday: "TH", friday: "FR", saturday: "SA" };
const DAY_NAMES = Object.fromEntries(Object.entries(DAY_CODES).map(([k, v]) => [v, k]));
const INDEX: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, last: -1 };
const INDEX_NAMES: Record<string, string> = { "1": "first", "2": "second", "3": "third", "4": "fourth", "-1": "last" };

interface GraphTime {
  dateTime: string;
  timeZone: string;
}

interface GraphRecurrence {
  pattern: { type: string; interval: number; daysOfWeek?: string[]; dayOfMonth?: number; month?: number; index?: string; firstDayOfWeek?: string };
  range: { type: string; startDate: string; endDate?: string; numberOfOccurrences?: number; recurrenceTimeZone?: string };
}

interface GraphEvent {
  id: string;
  "@odata.etag"?: string;
  "@removed"?: unknown;
  changeKey?: string;
  iCalUId?: string;
  subject?: string;
  body?: { contentType?: string; content?: string };
  location?: { displayName?: string };
  start?: GraphTime;
  end?: GraphTime;
  originalStart?: string;
  originalStartTimeZone?: string;
  originalEndTimeZone?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
  type?: "singleInstance" | "occurrence" | "exception" | "seriesMaster";
  seriesMasterId?: string;
  recurrence?: GraphRecurrence | null;
  showAs?: string;
  sensitivity?: string;
  organizer?: { emailAddress?: { address?: string; name?: string } };
  attendees?: { type?: string; status?: { response?: string }; emailAddress?: { address?: string; name?: string } }[];
  isOrganizer?: boolean;
  responseStatus?: { response?: string };
  isOnlineMeeting?: boolean;
  onlineMeeting?: { joinUrl?: string };
  onlineMeetingUrl?: string;
  isReminderOn?: boolean;
  reminderMinutesBeforeStart?: number;
  lastModifiedDateTime?: string;
  hideAttendees?: boolean;
}

function gr<T>(ctx: CalendarCtx, path: string, init?: Parameters<typeof providerFetch>[3]) {
  return providerFetch<T>("microsoft", ctx, path.startsWith("http") ? path : `${API}${path}`, init);
}

function utc(t: GraphTime | undefined): Date | null {
  if (!t?.dateTime) return null;
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(t.dateTime) ? t.dateTime : `${t.dateTime}Z`);
}

function toRrule(r: GraphRecurrence | null | undefined): string[] | null {
  if (!r?.pattern) return null;
  const p = r.pattern;
  const parts: string[] = [];
  const days = (p.daysOfWeek ?? []).map((d) => DAY_CODES[d.toLowerCase()]).filter(Boolean);
  switch (p.type) {
    case "daily":
      parts.push("FREQ=DAILY");
      break;
    case "weekly":
      parts.push("FREQ=WEEKLY");
      if (days.length) parts.push(`BYDAY=${days.join(",")}`);
      if (p.firstDayOfWeek) parts.push(`WKST=${DAY_CODES[p.firstDayOfWeek.toLowerCase()] ?? "MO"}`);
      break;
    case "absoluteMonthly":
      parts.push("FREQ=MONTHLY", `BYMONTHDAY=${p.dayOfMonth ?? 1}`);
      break;
    case "relativeMonthly":
      parts.push("FREQ=MONTHLY", `BYDAY=${days.join(",")}`, `BYSETPOS=${INDEX[p.index ?? "first"] ?? 1}`);
      break;
    case "absoluteYearly":
      parts.push("FREQ=YEARLY", `BYMONTH=${p.month ?? 1}`, `BYMONTHDAY=${p.dayOfMonth ?? 1}`);
      break;
    case "relativeYearly":
      parts.push("FREQ=YEARLY", `BYMONTH=${p.month ?? 1}`, `BYDAY=${days.join(",")}`, `BYSETPOS=${INDEX[p.index ?? "first"] ?? 1}`);
      break;
    default:
      return null;
  }
  if (p.interval && p.interval > 1) parts.push(`INTERVAL=${p.interval}`);
  if (r.range.type === "endDate" && r.range.endDate) parts.push(`UNTIL=${r.range.endDate.replace(/-/g, "")}T235959Z`);
  if (r.range.type === "numbered" && r.range.numberOfOccurrences) parts.push(`COUNT=${r.range.numberOfOccurrences}`);
  return [`RRULE:${parts.join(";")}`];
}

function fromRrule(lines: string[] | null, startDate: string, tz: string): GraphRecurrence | null {
  const rule = lines?.find((l) => l.toUpperCase().startsWith("RRULE"));
  if (!rule) return null;
  const kv = Object.fromEntries(
    rule
      .slice(rule.indexOf(":") + 1)
      .split(";")
      .map((p) => p.split("=") as [string, string]),
  );
  const interval = Number(kv.INTERVAL ?? 1);
  const byday = (kv.BYDAY ?? "").split(",").filter(Boolean);
  const days = byday.map((d: string) => DAY_NAMES[d.replace(/^[-+]?\d+/, "")]).filter(Boolean);
  const nth = byday[0]?.match(/^([-+]?\d+)/)?.[1] ?? kv.BYSETPOS;
  let pattern: GraphRecurrence["pattern"];
  switch (kv.FREQ) {
    case "DAILY":
      pattern = { type: "daily", interval };
      break;
    case "WEEKLY":
      pattern = {
        type: "weekly",
        interval,
        daysOfWeek: days.length ? days : [Object.keys(DAY_CODES)[new Date(`${startDate}T00:00:00Z`).getUTCDay()]],
        firstDayOfWeek: DAY_NAMES[kv.WKST ?? "SU"] ?? "sunday",
      };
      break;
    case "MONTHLY":
      pattern =
        nth && days.length
          ? { type: "relativeMonthly", interval, daysOfWeek: days, index: INDEX_NAMES[String(Number(nth))] ?? "first" }
          : { type: "absoluteMonthly", interval, dayOfMonth: Number(kv.BYMONTHDAY ?? new Date(`${startDate}T00:00:00Z`).getUTCDate()) };
      break;
    case "YEARLY": {
      const month = Number(kv.BYMONTH ?? new Date(`${startDate}T00:00:00Z`).getUTCMonth() + 1);
      pattern =
        nth && days.length
          ? { type: "relativeYearly", interval, month, daysOfWeek: days, index: INDEX_NAMES[String(Number(nth))] ?? "first" }
          : { type: "absoluteYearly", interval, month, dayOfMonth: Number(kv.BYMONTHDAY ?? new Date(`${startDate}T00:00:00Z`).getUTCDate()) };
      break;
    }
    default:
      return null;
  }
  const range: GraphRecurrence["range"] = kv.UNTIL
    ? { type: "endDate", startDate, endDate: `${kv.UNTIL.slice(0, 4)}-${kv.UNTIL.slice(4, 6)}-${kv.UNTIL.slice(6, 8)}`, recurrenceTimeZone: tz }
    : kv.COUNT
      ? { type: "numbered", startDate, numberOfOccurrences: Number(kv.COUNT), recurrenceTimeZone: tz }
      : { type: "noEnd", startDate, recurrenceTimeZone: tz };
  return { pattern, range };
}

function graphTz(tz: string | undefined, fallback: string): string {
  if (!tz || tz === "tzone://Microsoft/Custom" || tz === "tzone://Microsoft/Utc") return fallback;
  return safeTz(WINDOWS_TZ[tz] ?? tz, fallback);
}

export function fromGraph(e: GraphEvent, calendar: CalendarRow, masterProviderId?: string | null): NormalizedEvent {
  const startTz = graphTz(e.originalStartTimeZone, calendar.timezone);
  const endTz = graphTz(e.originalEndTimeZone, startTz);
  const startAt = utc(e.start);
  const endAt = utc(e.end);
  const organizer = e.organizer?.emailAddress?.address?.toLowerCase() ?? null;
  const attendees: NormalizedAttendee[] = (e.attendees ?? [])
    .filter((a) => a.emailAddress?.address)
    .map((a) => {
      const email = a.emailAddress!.address!.toLowerCase();
      return {
        email,
        name: a.emailAddress?.name ?? null,
        role: a.type === "resource" ? "resource" : a.type === "optional" ? "optional" : "required",
        status: RESPONSE_IN[a.status?.response ?? "none"] ?? "needs_action",
        isOrganizer: email === organizer,
      };
    });
  const allDayDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  const joinUrl = e.onlineMeeting?.joinUrl ?? e.onlineMeetingUrl ?? null;
  const original = e.originalStart ? new Date(e.originalStart) : null;
  return {
    providerEventId: e.id,
    etag: e["@odata.etag"] ?? e.changeKey ?? null,
    uid: e.iCalUId ?? e.id,
    recurringProviderEventId: e.type === "exception" || e.type === "occurrence" ? (e.seriesMasterId ?? masterProviderId ?? null) : null,
    originalStartAt: original,
    originalStartDate: e.isAllDay && original ? original.toISOString().slice(0, 10) : null,
    status: e.isCancelled ? "cancelled" : e.showAs === "tentative" ? "tentative" : "confirmed",
    title: e.subject ?? "",
    descriptionHtml: e.body?.content ? (e.body.contentType === "html" ? e.body.content : e.body.content.replace(/\n/g, "<br>")) : null,
    location: e.location?.displayName || null,
    isAllDay: !!e.isAllDay,
    startAt: e.isAllDay ? null : startAt,
    endAt: e.isAllDay ? null : endAt,
    startDate: e.isAllDay ? allDayDate(startAt) : null,
    endDate: e.isAllDay ? allDayDate(endAt) : null,
    startTz: e.isAllDay ? null : startTz,
    endTz: e.isAllDay ? null : endTz,
    rrule: e.type === "seriesMaster" ? toRrule(e.recurrence) : null,
    transparency: e.showAs === "free" || e.showAs === "workingElsewhere" ? "transparent" : "opaque",
    visibility: e.sensitivity === "private" || e.sensitivity === "personal" ? "private" : e.sensitivity === "confidential" ? "confidential" : "default",
    eventType: e.showAs === "oof" ? "out_of_office" : e.showAs === "workingElsewhere" ? "working_location" : "default",
    organizer: organizer ? { email: organizer, name: e.organizer?.emailAddress?.name ?? null, self: !!e.isOrganizer } : null,
    attendees,
    attendeesOmitted: !!e.hideAttendees && !e.isOrganizer,
    conference: joinUrl ? { type: /teams\.microsoft/.test(joinUrl) ? "teams" : "custom", url: joinUrl } : null,
    reminders:
      e.isReminderOn === false ? [] : typeof e.reminderMinutesBeforeStart === "number" ? [{ method: "popup", minutes: e.reminderMinutesBeforeStart }] : null,
    providerData: { type: e.type, seriesMasterId: e.seriesMasterId ?? null },
    providerUpdatedAt: e.lastModifiedDateTime ? new Date(e.lastModifiedDateTime) : null,
  };
}

function toGraph(write: EventWrite): Record<string, unknown> {
  const e = write.event;
  const tz = e.startTz ?? "UTC";
  const time = (at: Date | null, date: string | null) =>
    e.isAllDay ? { dateTime: `${date}T00:00:00`, timeZone: "UTC" } : { dateTime: at!.toISOString().replace("Z", ""), timeZone: "UTC" };
  const body: Record<string, unknown> = {
    subject: e.title,
    body: { contentType: "html", content: e.descriptionHtml ?? "" },
    location: { displayName: e.location ?? "" },
    start: time(e.startAt, e.startDate),
    end: time(e.endAt, e.endDate),
    isAllDay: e.isAllDay,
    showAs:
      e.eventType === "out_of_office"
        ? "oof"
        : e.eventType === "working_location"
          ? "workingElsewhere"
          : e.transparency === "transparent"
            ? "free"
            : e.status === "tentative"
              ? "tentative"
              : "busy",
    sensitivity: e.visibility === "private" ? "private" : e.visibility === "confidential" ? "confidential" : "normal",
    attendees: write.attendees
      .filter((a) => !a.isOrganizer)
      .map((a) => ({
        emailAddress: { address: a.email, name: a.name ?? a.email },
        type: a.role === "optional" ? "optional" : a.role === "resource" ? "resource" : "required",
      })),
    isReminderOn: write.reminders ? write.reminders.length > 0 : true,
  };
  if (write.reminders?.length) body.reminderMinutesBeforeStart = Math.min(...write.reminders.map((r) => r.minutes));
  if (!e.recurringEventId) {
    const startDate = e.isAllDay ? e.startDate! : e.startAt!.toISOString().slice(0, 10);
    body.recurrence = fromRrule(e.rrule, startDate, tz);
  }
  if (e.conference?.create) {
    body.isOnlineMeeting = true;
    body.onlineMeetingProvider = "teamsForBusiness";
  }
  return body;
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ProviderHttpError && e.status === 412) throw new PreconditionFailedError();
    throw e;
  }
}

async function findInstance(ctx: CalendarCtx, write: EventWrite): Promise<string> {
  if (write.event.providerEventId) return write.event.providerEventId;
  const master = write.master;
  if (!master?.providerEventId) throw new Error("master_not_pushed");
  const original = write.event.originalStartAt ?? (write.event.originalStartDate ? new Date(`${write.event.originalStartDate}T00:00:00Z`) : null);
  if (!original) throw new Error("instance_not_found");
  const from = new Date(original.getTime() - 86_400_000).toISOString();
  const to = new Date(original.getTime() + 2 * 86_400_000).toISOString();
  const res = await gr<{ value: GraphEvent[] }>(
    ctx,
    `/events/${master.providerEventId}/instances?startDateTime=${from}&endDateTime=${to}&$select=id,originalStart`,
    { headers: { Prefer: UTC_PREFER } },
  );
  const hit =
    res.value.find((i) => i.originalStart && Math.abs(new Date(i.originalStart).getTime() - original.getTime()) < 60_000) ??
    (res.value.length === 1 ? res.value[0] : null);
  if (!hit) throw new Error("instance_not_found");
  return hit.id;
}

export const graphCalendarConnector: CalendarConnector = {
  async listCalendars(ctx) {
    const settings = await gr<{ timeZone?: string }>(ctx, "/mailboxSettings?$select=timeZone").catch(() => ({ timeZone: "UTC" }));
    const tz = graphTz(settings.timeZone, "UTC");
    const out: NormalizedCalendar[] = [];
    let url: string | undefined = "/calendars?$top=100";
    while (url) {
      const page: {
        value: {
          id: string;
          name: string;
          hexColor?: string;
          canEdit?: boolean;
          isDefaultCalendar?: boolean;
          allowedOnlineMeetingProviders?: string[];
          owner?: { address?: string };
        }[];
        "@odata.nextLink"?: string;
      } = await gr(ctx, url);
      for (const c of page.value) {
        const own = c.owner?.address?.toLowerCase() === ctx.account.address.toLowerCase();
        out.push({
          providerCalendarId: c.id,
          name: c.name,
          color: c.hexColor || null,
          timezone: tz,
          accessRole: own || c.isDefaultCalendar ? "owner" : c.canEdit ? "writer" : "reader",
          isPrimary: !!c.isDefaultCalendar,
          kind: c.isDefaultCalendar ? "default" : /birthday/i.test(c.name) ? "birthdays" : /holiday/i.test(c.name) ? "holiday" : "regular",
          defaultReminders: [{ method: "popup", minutes: 15 }],
          allowedConference: (c.allowedOnlineMeetingProviders ?? []).includes("teamsForBusiness") ? ["teams"] : [],
        });
      }
      url = page["@odata.nextLink"];
    }
    return out;
  },

  async syncEvents(ctx, calendar, opts) {
    const url =
      opts.pageCursor ??
      opts.cursor ??
      `/calendars/${calendar.providerCalendarId}/calendarView/delta?startDateTime=${opts.from.toISOString()}&endDateTime=${opts.to.toISOString()}`;
    let page: { value: GraphEvent[]; "@odata.nextLink"?: string; "@odata.deltaLink"?: string };
    try {
      page = await gr(ctx, url, { headers: { Prefer: `${UTC_PREFER}, odata.maxpagesize=100` } });
    } catch (e) {
      if (e instanceof ProviderHttpError && (e.status === 410 || /syncStateNotFound|resyncRequired/i.test(e.body))) throw new SyncTokenExpiredError();
      throw e;
    }
    const events: NormalizedEvent[] = [];
    const deleted: string[] = [];
    const series = new Set<string>();
    for (const item of page.value) {
      if (item["@removed"]) {
        deleted.push(item.id);
        continue;
      }
      if (item.type === "occurrence" || item.type === "exception") {
        if (item.seriesMasterId) series.add(item.seriesMasterId);
        if (item.type === "occurrence") continue;
      }
      events.push(fromGraph(item, calendar));
    }
    return {
      events,
      deleted,
      cursor: page["@odata.deltaLink"] ?? null,
      more: !!page["@odata.nextLink"],
      pageCursor: page["@odata.nextLink"] ?? null,
      full: !opts.cursor && !opts.pageCursor,
      seriesToRefresh: [...series],
    };
  },

  async fetchEvent(ctx, calendar, providerEventId) {
    const e = await gr<GraphEvent | null>(ctx, `/events/${providerEventId}`, { headers: { Prefer: UTC_PREFER }, allow: [404] });
    return e ? [fromGraph(e, calendar)] : null;
  },

  async fetchSeries(ctx, calendar, masterId, from, to) {
    const master = await gr<GraphEvent | null>(ctx, `/events/${masterId}`, { headers: { Prefer: UTC_PREFER }, allow: [404] });
    if (!master) return [];
    const normalized = fromGraph(master, calendar);
    const instances: GraphEvent[] = [];
    let url: string | undefined = `/events/${masterId}/instances?startDateTime=${from.toISOString()}&endDateTime=${to.toISOString()}&$top=200`;
    while (url) {
      const page: { value: GraphEvent[]; "@odata.nextLink"?: string } = await gr(ctx, url, { headers: { Prefer: UTC_PREFER } });
      instances.push(...page.value);
      url = page["@odata.nextLink"];
    }
    // Dates the rule produces but Graph doesn't list were cancelled: keep them out locally as EXDATEs.
    const present = new Set(instances.map((i) => (i.originalStart ? new Date(i.originalStart).getTime() : 0)));
    const expected = expand(
      {
        rrule: normalized.rrule ?? null,
        isAllDay: normalized.isAllDay,
        startAt: normalized.startAt ?? null,
        endAt: normalized.endAt ?? null,
        startDate: normalized.startDate ?? null,
        endDate: normalized.endDate ?? null,
        startTz: normalized.startTz ?? null,
      },
      from,
      to,
    );
    const exdates = expected
      .filter((i) => !present.has(i.originalStart.getTime()))
      .map((i) =>
        normalized.isAllDay
          ? `EXDATE;VALUE=DATE:${i.originalStart.toISOString().slice(0, 10).replace(/-/g, "")}`
          : `EXDATE:${i.originalStart
              .toISOString()
              .replace(/[-:]/g, "")
              .replace(/\.\d{3}/, "")}`,
      );
    if (normalized.rrule && exdates.length) normalized.rrule = [...normalized.rrule, ...exdates];
    return [normalized, ...instances.filter((i) => i.type === "exception").map((i) => fromGraph(i, calendar, masterId))];
  },

  async create(ctx, calendar, write) {
    const res = await gr<GraphEvent>(ctx, `/calendars/${calendar.providerCalendarId}/events`, {
      method: "POST",
      body: toGraph(write),
      headers: { Prefer: UTC_PREFER },
    });
    return { providerEventId: res.id, etag: res["@odata.etag"] ?? null, normalized: fromGraph(res, calendar) };
  },

  async update(ctx, calendar, write, etag) {
    const res = await guard(() =>
      gr<GraphEvent>(ctx, `/events/${write.event.providerEventId}`, {
        method: "PATCH",
        body: toGraph(write),
        headers: { Prefer: UTC_PREFER, ...(etag ? { "if-match": etag } : {}) },
      }),
    );
    return { providerEventId: res.id, etag: res["@odata.etag"] ?? null, normalized: fromGraph(res, calendar) };
  },

  async updateInstance(ctx, calendar, write, etag) {
    const id = await findInstance(ctx, write);
    if (write.event.status === "cancelled") {
      await gr(ctx, `/events/${id}`, { method: "DELETE", allow: [404] });
      return { providerEventId: id, etag: null };
    }
    const res = await guard(() =>
      gr<GraphEvent>(ctx, `/events/${id}`, {
        method: "PATCH",
        body: toGraph(write),
        headers: { Prefer: UTC_PREFER, ...(etag && write.event.providerEventId ? { "if-match": etag } : {}) },
      }),
    );
    return { providerEventId: res.id, etag: res["@odata.etag"] ?? null, normalized: fromGraph(res, calendar, write.master?.providerEventId) };
  },

  async remove(ctx, _calendar, providerEventId, etag) {
    await guard(() => gr(ctx, `/events/${providerEventId}`, { method: "DELETE", allow: [404], headers: etag ? { "if-match": etag } : {} }));
  },

  async respond(ctx, calendar, write, status, comment) {
    const id = write.event.recurringEventId ? await findInstance(ctx, write) : write.event.providerEventId!;
    const action = status === "accepted" ? "accept" : status === "declined" ? "decline" : "tentativelyAccept";
    await gr(ctx, `/events/${id}/${action}`, { method: "POST", body: { comment: comment ?? "", sendResponse: true } });
    const res = await gr<GraphEvent>(ctx, `/events/${id}`, { headers: { Prefer: UTC_PREFER } });
    return { providerEventId: res.id, etag: res["@odata.etag"] ?? null, normalized: fromGraph(res, calendar) };
  },

  async freeBusy(ctx, emails, from, to) {
    const res = await gr<{ value: { scheduleId: string; scheduleItems?: { start: GraphTime; end: GraphTime; status?: string }[]; error?: unknown }[] }>(
      ctx,
      "/calendar/getSchedule",
      {
        method: "POST",
        body: {
          schedules: emails,
          startTime: { dateTime: from.toISOString().replace("Z", ""), timeZone: "UTC" },
          endTime: { dateTime: to.toISOString().replace("Z", ""), timeZone: "UTC" },
          availabilityViewInterval: 30,
        },
        headers: { Prefer: UTC_PREFER },
      },
    );
    const out: Record<string, { start: Date; end: Date }[]> = {};
    for (const s of res.value ?? []) {
      if (s.error) continue;
      out[s.scheduleId.toLowerCase()] = (s.scheduleItems ?? []).filter((i) => i.status !== "free").map((i) => ({ start: utc(i.start)!, end: utc(i.end)! }));
    }
    return out;
  },

  async watch(ctx, calendar, address, _channelId, token) {
    const expires = new Date(Date.now() + 4000 * 60_000);
    const res = await gr<{ id: string; expirationDateTime: string }>(ctx, "https://graph.microsoft.com/v1.0/subscriptions", {
      method: "POST",
      body: {
        changeType: "created,updated,deleted",
        notificationUrl: address,
        resource: `/me/calendars/${calendar.providerCalendarId}/events`,
        expirationDateTime: expires.toISOString(),
        clientState: token,
      },
    });
    return { resourceId: res.id, expiresAt: new Date(res.expirationDateTime) };
  },

  async unwatch(ctx, _channelId, resourceId) {
    if (resourceId) await gr(ctx, `https://graph.microsoft.com/v1.0/subscriptions/${resourceId}`, { method: "DELETE", allow: [404] });
  },
};
