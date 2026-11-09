import { providerFetch, ProviderHttpError } from "../../accounts/provider-http";
import type { CalendarReminderSpec } from "../../../plugins/db";
import { safeTz } from "../tz";
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

// Google Calendar v3. Events sync with singleEvents=false (masters +
// overrides, like iCalendar) and showDeleted so cancellations arrive as
// deltas; the first page set uses timeMin (import window) and later runs use
// the stored syncToken.

const API = "https://www.googleapis.com/calendar/v3";

const EVENT_COLORS: Record<string, string> = {
  "1": "#7986cb",
  "2": "#33b679",
  "3": "#8e24aa",
  "4": "#e67c73",
  "5": "#f6bf26",
  "6": "#f4511e",
  "7": "#039be5",
  "8": "#616161",
  "9": "#3f51b5",
  "10": "#0b8043",
  "11": "#d50000",
};

const RESPONSE_IN: Record<string, string> = { needsAction: "needs_action", accepted: "accepted", declined: "declined", tentative: "tentative" };
const RESPONSE_OUT: Record<string, string> = {
  needs_action: "needsAction",
  accepted: "accepted",
  declined: "declined",
  tentative: "tentative",
  delegated: "needsAction",
};
const TYPE_IN: Record<string, string> = { outOfOffice: "out_of_office", focusTime: "focus_time", workingLocation: "working_location", birthday: "birthday" };
const TYPE_OUT: Record<string, string> = { out_of_office: "outOfOffice", focus_time: "focusTime", working_location: "workingLocation" };

interface GTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

interface GEvent {
  id: string;
  etag?: string;
  iCalUID?: string;
  sequence?: number;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GTime;
  end?: GTime;
  originalStartTime?: GTime;
  recurringEventId?: string;
  recurrence?: string[];
  transparency?: string;
  visibility?: string;
  eventType?: string;
  colorId?: string;
  organizer?: { email?: string; displayName?: string; self?: boolean };
  attendees?: {
    email?: string;
    displayName?: string;
    responseStatus?: string;
    optional?: boolean;
    resource?: boolean;
    organizer?: boolean;
    self?: boolean;
    comment?: string;
    additionalGuests?: number;
  }[];
  attendeesOmitted?: boolean;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string; pin?: string }[]; conferenceSolution?: { key?: { type?: string } } };
  reminders?: { useDefault?: boolean; overrides?: { method: string; minutes: number }[] };
  guestsCanModify?: boolean;
  guestsCanInviteOthers?: boolean;
  guestsCanSeeOtherGuests?: boolean;
  updated?: string;
  outOfOfficeProperties?: Record<string, unknown>;
  focusTimeProperties?: Record<string, unknown>;
  workingLocationProperties?: Record<string, unknown>;
}

function g<T>(ctx: CalendarCtx, path: string, init?: Parameters<typeof providerFetch>[3]) {
  return providerFetch<T>("google", ctx, `${API}${path}`, init);
}

function cal(calendar: CalendarRow) {
  return encodeURIComponent(calendar.providerCalendarId ?? "primary");
}

function readTime(t: GTime | undefined, fallbackTz: string) {
  if (!t) return { at: null, date: null, tz: null };
  if (t.date) return { at: null, date: t.date, tz: null };
  return { at: t.dateTime ? new Date(t.dateTime) : null, date: null, tz: safeTz(t.timeZone, fallbackTz) };
}

function nearestColorId(hex: string | null): string | undefined {
  if (!hex) return undefined;
  const target = parseInt(hex.replace("#", ""), 16);
  let best: string | undefined;
  let bestDist = Infinity;
  for (const [id, c] of Object.entries(EVENT_COLORS)) {
    const v = parseInt(c.replace("#", ""), 16);
    const d = Math.abs(((v >> 16) & 255) - ((target >> 16) & 255)) + Math.abs(((v >> 8) & 255) - ((target >> 8) & 255)) + Math.abs((v & 255) - (target & 255));
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}

export function fromGoogle(e: GEvent, calendar: CalendarRow): NormalizedEvent {
  const tz = calendar.timezone;
  const start = readTime(e.start, tz);
  const end = readTime(e.end, tz);
  const original = e.originalStartTime ? readTime(e.originalStartTime, tz) : null;
  const video = e.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video");
  const attendees: NormalizedAttendee[] = (e.attendees ?? [])
    .filter((a) => a.email)
    .map((a) => ({
      email: a.email!.toLowerCase(),
      name: a.displayName ?? null,
      role: a.resource ? "resource" : a.optional ? "optional" : "required",
      status: RESPONSE_IN[a.responseStatus ?? "needsAction"] ?? "needs_action",
      comment: a.comment ?? null,
      isOrganizer: !!a.organizer,
      isSelf: !!a.self,
      additionalGuests: a.additionalGuests ?? 0,
    }));
  const reminders: CalendarReminderSpec[] | null =
    e.reminders?.useDefault === false
      ? (e.reminders.overrides ?? []).map((r) => ({ method: r.method === "email" ? "email" : "popup", minutes: r.minutes }))
      : null;
  return {
    providerEventId: e.id,
    etag: e.etag ?? null,
    uid: e.iCalUID ?? e.id,
    sequence: e.sequence ?? 0,
    recurringProviderEventId: e.recurringEventId ?? null,
    originalStartAt: original ? (original.at ?? (original.date ? new Date(`${original.date}T00:00:00Z`) : null)) : null,
    originalStartDate: original?.date ?? null,
    status: e.status === "cancelled" ? "cancelled" : e.status === "tentative" ? "tentative" : "confirmed",
    title: e.summary ?? "",
    descriptionHtml: e.description ?? null,
    location: e.location ?? null,
    isAllDay: !!start.date,
    startAt: start.at,
    endAt: end.at,
    startDate: start.date,
    endDate: end.date,
    startTz: start.tz,
    endTz: end.tz ?? start.tz,
    rrule: e.recurrence?.length ? e.recurrence : null,
    transparency: e.transparency === "transparent" ? "transparent" : "opaque",
    visibility: e.visibility && e.visibility !== "default" ? e.visibility : "default",
    eventType: TYPE_IN[e.eventType ?? ""] ?? "default",
    eventTypeProps: e.outOfOfficeProperties ?? e.focusTimeProperties ?? e.workingLocationProperties ?? {},
    color: e.colorId ? (EVENT_COLORS[e.colorId] ?? null) : null,
    organizer: e.organizer?.email ? { email: e.organizer.email.toLowerCase(), name: e.organizer.displayName ?? null, self: !!e.organizer.self } : null,
    attendees,
    attendeesOmitted: !!e.attendeesOmitted,
    conference: video?.uri
      ? { type: e.conferenceData?.conferenceSolution?.key?.type === "hangoutsMeet" ? "meet" : "custom", url: video.uri, pin: video.pin ?? null }
      : e.hangoutLink
        ? { type: "meet", url: e.hangoutLink }
        : null,
    reminders,
    guestsCanModify: !!e.guestsCanModify,
    guestsCanInviteOthers: e.guestsCanInviteOthers ?? true,
    guestsCanSeeOthers: e.guestsCanSeeOtherGuests ?? true,
    providerUpdatedAt: e.updated ? new Date(e.updated) : null,
  };
}

function toGoogle(write: EventWrite): Record<string, unknown> {
  const e = write.event;
  const time = (at: Date | null, date: string | null, tz: string | null): GTime =>
    e.isAllDay ? { date: date ?? undefined } : { dateTime: at?.toISOString(), timeZone: tz ?? "UTC" };
  const body: Record<string, unknown> = {
    summary: e.title,
    description: e.descriptionHtml ?? "",
    location: e.location ?? "",
    start: time(e.startAt, e.startDate, e.startTz),
    end: time(e.endAt, e.endDate, e.endTz ?? e.startTz),
    status: e.status,
    transparency: e.transparency,
    visibility: e.visibility,
    guestsCanModify: e.guestsCanModify,
    guestsCanInviteOthers: e.guestsCanInviteOthers,
    guestsCanSeeOtherGuests: e.guestsCanSeeOthers,
    attendees: write.attendees.map((a) => ({
      email: a.email,
      displayName: a.name ?? undefined,
      optional: a.role === "optional",
      resource: a.role === "resource" || undefined,
      responseStatus: RESPONSE_OUT[a.status ?? "needs_action"] ?? "needsAction",
      comment: a.comment ?? undefined,
    })),
    reminders: write.reminders
      ? { useDefault: false, overrides: write.reminders.map((r) => ({ method: r.method, minutes: r.minutes })) }
      : { useDefault: true },
  };
  if (!e.recurringEventId) body.recurrence = e.rrule ?? [];
  const colorId = nearestColorId(e.color);
  if (colorId) body.colorId = colorId;
  if (e.eventType !== "default" && TYPE_OUT[e.eventType]) {
    body.eventType = TYPE_OUT[e.eventType];
    if (e.eventType === "out_of_office") body.outOfOfficeProperties = { autoDeclineMode: "declineOnlyNewConflictingInvitations", ...e.eventTypeProps };
    if (e.eventType === "focus_time") body.focusTimeProperties = { autoDeclineMode: "declineNone", ...e.eventTypeProps };
    if (e.eventType === "working_location") body.workingLocationProperties = { type: "homeOffice", homeOffice: {}, ...e.eventTypeProps };
  }
  if (e.conference?.create) body.conferenceData = { createRequest: { requestId: `${e.id}-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } } };
  else if (e.conference === null) body.conferenceData = null;
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

async function instanceId(ctx: CalendarCtx, calendar: CalendarRow, write: EventWrite): Promise<string> {
  if (write.event.providerEventId) return write.event.providerEventId;
  const master = write.master;
  if (!master?.providerEventId) throw new Error("master_not_pushed");
  const original = write.event.originalStartDate ?? write.event.originalStartAt?.toISOString();
  const params = new URLSearchParams({ originalStart: original ?? "", showDeleted: "true" });
  const res = await g<{ items?: GEvent[] }>(ctx, `/calendars/${cal(calendar)}/events/${encodeURIComponent(master.providerEventId)}/instances?${params}`);
  const id = res.items?.[0]?.id;
  if (!id) throw new Error("instance_not_found");
  return id;
}

export const googleCalendarConnector: CalendarConnector = {
  async listCalendars(ctx) {
    const out: NormalizedCalendar[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ maxResults: "250", showHidden: "true" });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await g<{
        items?: {
          id: string;
          summary?: string;
          summaryOverride?: string;
          description?: string;
          backgroundColor?: string;
          timeZone?: string;
          accessRole?: string;
          primary?: boolean;
          defaultReminders?: { method: string; minutes: number }[];
          conferenceProperties?: { allowedConferenceSolutionTypes?: string[] };
        }[];
        nextPageToken?: string;
      }>(ctx, `/users/me/calendarList?${params}`);
      for (const c of page.items ?? []) {
        const role = c.accessRole === "owner" ? "owner" : c.accessRole === "writer" ? "writer" : c.accessRole === "reader" ? "reader" : "free_busy";
        out.push({
          providerCalendarId: c.id,
          name: c.summaryOverride ?? c.summary ?? c.id,
          description: c.description ?? null,
          color: c.backgroundColor ?? null,
          timezone: safeTz(c.timeZone),
          accessRole: role,
          isPrimary: !!c.primary,
          kind: c.id.endsWith("#holiday@group.v.calendar.google.com")
            ? "holiday"
            : c.id.includes("#contacts@")
              ? "birthdays"
              : c.primary
                ? "default"
                : "regular",
          defaultReminders: (c.defaultReminders ?? []).map((r) => ({ method: r.method === "email" ? "email" : "popup", minutes: r.minutes })),
          allowedConference: (c.conferenceProperties?.allowedConferenceSolutionTypes ?? []).includes("hangoutsMeet") ? ["meet"] : [],
        });
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
    return out;
  },

  async syncEvents(ctx, calendar, opts) {
    const params = new URLSearchParams({ maxResults: "250", singleEvents: "false", showDeleted: "true" });
    if (opts.pageCursor) params.set("pageToken", opts.pageCursor);
    if (opts.cursor) params.set("syncToken", opts.cursor);
    else params.set("timeMin", opts.from.toISOString());
    let page: { items?: GEvent[]; nextPageToken?: string; nextSyncToken?: string };
    try {
      page = await g(ctx, `/calendars/${cal(calendar)}/events?${params}`);
    } catch (e) {
      if (e instanceof ProviderHttpError && e.status === 410) throw new SyncTokenExpiredError();
      throw e;
    }
    const events: NormalizedEvent[] = [];
    const deleted: string[] = [];
    for (const item of page.items ?? []) {
      if (item.status === "cancelled" && !item.recurringEventId) deleted.push(item.id);
      else events.push(fromGoogle(item, calendar));
    }
    return { events, deleted, cursor: page.nextSyncToken ?? null, more: !!page.nextPageToken, pageCursor: page.nextPageToken ?? null, full: !opts.cursor };
  },

  async fetchEvent(ctx, calendar, providerEventId) {
    const e = await g<GEvent | null>(ctx, `/calendars/${cal(calendar)}/events/${encodeURIComponent(providerEventId)}`, { allow: [404, 410] });
    return e ? [fromGoogle(e, calendar)] : null;
  },

  async create(ctx, calendar, write) {
    const body = { ...toGoogle(write), iCalUID: write.event.uid };
    const res = await g<GEvent>(ctx, `/calendars/${cal(calendar)}/events?conferenceDataVersion=1&sendUpdates=all`, { method: "POST", body });
    return { providerEventId: res.id, etag: res.etag ?? null, normalized: fromGoogle(res, calendar) };
  },

  async update(ctx, calendar, write, etag) {
    const res = await guard(() =>
      g<GEvent>(ctx, `/calendars/${cal(calendar)}/events/${encodeURIComponent(write.event.providerEventId!)}?conferenceDataVersion=1&sendUpdates=all`, {
        method: "PATCH",
        body: toGoogle(write),
        headers: etag ? { "if-match": etag } : {},
      }),
    );
    return { providerEventId: res.id, etag: res.etag ?? null, normalized: fromGoogle(res, calendar) };
  },

  async updateInstance(ctx, calendar, write, etag) {
    const id = await instanceId(ctx, calendar, write);
    if (write.event.status === "cancelled") {
      await guard(() =>
        g(ctx, `/calendars/${cal(calendar)}/events/${encodeURIComponent(id)}?sendUpdates=all`, {
          method: "DELETE",
          allow: [404, 410],
          headers: etag ? { "if-match": etag } : {},
        }),
      );
      return { providerEventId: id, etag: null };
    }
    const res = await guard(() =>
      g<GEvent>(ctx, `/calendars/${cal(calendar)}/events/${encodeURIComponent(id)}?conferenceDataVersion=1&sendUpdates=all`, {
        method: "PATCH",
        body: toGoogle(write),
        headers: etag && write.event.providerEventId ? { "if-match": etag } : {},
      }),
    );
    return { providerEventId: res.id, etag: res.etag ?? null, normalized: fromGoogle(res, calendar) };
  },

  async remove(ctx, calendar, providerEventId, etag) {
    await guard(() =>
      g(ctx, `/calendars/${cal(calendar)}/events/${encodeURIComponent(providerEventId)}?sendUpdates=all`, {
        method: "DELETE",
        allow: [404, 410],
        headers: etag ? { "if-match": etag } : {},
      }),
    );
  },

  async respond(ctx, calendar, write, status, comment) {
    const id = write.event.recurringEventId ? await instanceId(ctx, calendar, write) : write.event.providerEventId!;
    const current = await g<GEvent>(ctx, `/calendars/${cal(calendar)}/events/${encodeURIComponent(id)}`);
    const attendees = (current.attendees ?? []).map((a) =>
      a.self ? { ...a, responseStatus: RESPONSE_OUT[status] ?? "needsAction", comment: comment ?? undefined } : a,
    );
    const res = await g<GEvent>(ctx, `/calendars/${cal(calendar)}/events/${encodeURIComponent(id)}?sendUpdates=all`, { method: "PATCH", body: { attendees } });
    return { providerEventId: res.id, etag: res.etag ?? null, normalized: fromGoogle(res, calendar) };
  },

  async move(ctx, from, to, providerEventId) {
    const res = await g<GEvent>(ctx, `/calendars/${cal(from)}/events/${encodeURIComponent(providerEventId)}/move?destination=${cal(to)}&sendUpdates=none`, {
      method: "POST",
    });
    return { providerEventId: res.id, etag: res.etag ?? null, normalized: fromGoogle(res, to) };
  },

  async freeBusy(ctx, emails, from, to) {
    const res = await g<{ calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> }>(ctx, "/freeBusy", {
      method: "POST",
      body: { timeMin: from.toISOString(), timeMax: to.toISOString(), items: emails.map((id) => ({ id })) },
    });
    const out: Record<string, { start: Date; end: Date }[]> = {};
    for (const [email, v] of Object.entries(res.calendars ?? {})) {
      if (v.errors?.length) continue;
      out[email.toLowerCase()] = (v.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
    }
    return out;
  },

  async watch(ctx, calendar, address, channelId, token) {
    const res = await g<{ resourceId: string; expiration?: string }>(ctx, `/calendars/${cal(calendar)}/events/watch`, {
      method: "POST",
      body: { id: channelId, type: "web_hook", address, token, params: { ttl: String(7 * 86_400) } },
    });
    return { resourceId: res.resourceId, expiresAt: new Date(Number(res.expiration ?? Date.now() + 6 * 86_400_000)) };
  },

  async unwatch(ctx, channelId, resourceId) {
    await g(ctx, "/channels/stop", { method: "POST", body: { id: channelId, resourceId }, allow: [404] });
  },
};
