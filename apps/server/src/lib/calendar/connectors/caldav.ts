import { createDAVClient, type DAVCalendar } from "tsdav";
import { EmailAuthError } from "../../email/types";
import { parseIcs, serializeIcs, type SerializableEvent } from "../ical";
import {
  PreconditionFailedError,
  type CalendarConnector,
  type CalendarCtx,
  type CalendarRow,
  type EventRow,
  type EventWrite,
  type NormalizedAttendee,
  type NormalizedCalendar,
  type NormalizedEvent,
} from "../types";
import { withExdate } from "../recurrence";

// CalDAV (iCloud, Fastmail, Yahoo, Nextcloud, …). A resource (.ics href) holds
// a master plus its overrides; local ids are href (master/single) and
// href#recurrence-id (override). Change detection: ctag first, then an etag
// listing over the import window, then multiget for what changed.

type Client = Awaited<ReturnType<typeof createDAVClient>>;

const clients = new Map<string, { client: Client; at: number }>();
const CLIENT_TTL_MS = 10 * 60_000;
const MULTIGET_CHUNK = 50;

interface DavConfig {
  caldavUrl?: string;
  username?: string;
}

async function client(account: { id?: string; address: string; config: Record<string, unknown> }, credentials: Record<string, unknown>): Promise<Client> {
  const key = account.id ? `${account.id}:${String(credentials.password ?? "").length}` : null;
  const cached = key ? clients.get(key) : null;
  if (cached && Date.now() - cached.at < CLIENT_TTL_MS) return cached.client;
  const cfg = account.config as DavConfig;
  if (!cfg.caldavUrl) throw new Error("caldav_url_required");
  try {
    const c = await createDAVClient({
      serverUrl: cfg.caldavUrl,
      credentials: { username: cfg.username || account.address, password: String(credentials.password ?? "") },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });
    if (key) clients.set(key, { client: c, at: Date.now() });
    return c;
  } catch (e) {
    const message = (e as Error).message ?? "";
    if (/401|unauthori[sz]ed|invalid credentials/i.test(message)) throw new EmailAuthError(`caldav_unauthorized: ${message}`);
    throw new Error(`caldav_connect_failed: ${message}`);
  }
}

export async function verifyCaldav(account: { address: string; config: Record<string, unknown> }, credentials: Record<string, unknown>) {
  const c = await client(account, credentials);
  const calendars = await c.fetchCalendars();
  if (!calendars.length) throw new Error("caldav_no_calendars");
}

function displayName(value: DAVCalendar["displayName"]): string {
  if (typeof value === "string") return value;
  return "Calendar";
}

function davCalendar(calendar: CalendarRow): DAVCalendar {
  return { url: calendar.providerCalendarId! };
}

/** Canonical href: absolute, with the path percent-decoded (servers differ on encoding "@" etc.). */
function resolveHref(base: string, href: string): string {
  try {
    const url = new URL(href, base);
    return `${url.origin}${decodeURIComponent(url.pathname)}`;
  } catch {
    return href;
  }
}

function requestUrl(href: string): string {
  try {
    const url = new URL(href);
    return `${url.origin}${url.pathname
      .split("/")
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join("/")}`;
  } catch {
    return href;
  }
}

function icalStamp(d: Date) {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Maps parsed VEVENTs of one resource to local ids. */
function mapResource(href: string, etag: string | null, text: string): NormalizedEvent[] {
  const parsed = parseIcs(text);
  return parsed.events.map((e) => {
    const isOverride = !!e.recurringProviderEventId;
    const rid = e.originalStartDate ?? e.originalStartAt?.toISOString() ?? "";
    return {
      ...e,
      providerEventId: isOverride ? `${href}#${rid}` : href,
      recurringProviderEventId: isOverride ? href : null,
      etag,
      rawIcs: isOverride ? null : text,
      providerData: { href },
    };
  });
}

function toSerializable(e: EventRow, attendees: NormalizedAttendee[], reminders: { method: string; minutes: number }[] | null): SerializableEvent {
  return {
    uid: e.uid,
    sequence: e.sequence,
    status: e.status,
    title: e.title,
    descriptionHtml: e.descriptionHtml,
    location: e.location,
    isAllDay: e.isAllDay,
    startAt: e.startAt,
    endAt: e.endAt,
    startDate: e.startDate,
    endDate: e.endDate,
    startTz: e.startTz,
    endTz: e.endTz,
    isFloating: e.isFloating,
    rrule: e.recurringEventId ? null : e.rrule,
    originalStartAt: e.recurringEventId ? e.originalStartAt : null,
    originalStartDate: e.recurringEventId ? e.originalStartDate : null,
    transparency: e.transparency,
    visibility: e.visibility,
    organizer: e.organizer,
    attendees,
    conference: e.conference,
    reminders,
    updatedAt: e.updatedAt,
  };
}

/** Whole resource for a write: master (+ edits) and every override. */
function resourceText(write: EventWrite, opts: { cancelInstance?: boolean } = {}): string {
  const master = write.master ?? write.event;
  const isInstance = !!write.event.recurringEventId;
  let masterRow = master;
  if (isInstance && opts.cancelInstance) {
    const original = write.event.originalStartAt ?? new Date(`${write.event.originalStartDate}T00:00:00Z`);
    masterRow = { ...master, rrule: withExdate(master, original) };
  }
  const events: SerializableEvent[] = [
    toSerializable(
      masterRow,
      isInstance ? (write.overrides?.find((o) => o.event.id === master.id)?.attendees ?? write.attendees) : write.attendees,
      isInstance ? null : write.reminders,
    ),
  ];
  for (const o of write.overrides ?? []) {
    if (o.event.id === master.id) continue;
    if (isInstance && o.event.id === write.event.id) {
      if (opts.cancelInstance) continue;
      events.push(toSerializable(write.event, write.attendees, write.reminders));
    } else if (o.event.status !== "cancelled" && !o.event.deletedAt) events.push(toSerializable(o.event, o.attendees, null));
  }
  if (isInstance && !opts.cancelInstance && !(write.overrides ?? []).some((o) => o.event.id === write.event.id))
    events.push(toSerializable(write.event, write.attendees, write.reminders));
  return serializeIcs(events);
}

function check(res: Response) {
  if (res.status === 412) throw new PreconditionFailedError();
  if (res.status === 401 || res.status === 403) throw new EmailAuthError(`caldav_${res.status}`);
  if (!res.ok && res.status !== 404) throw new Error(`caldav_write_failed: ${res.status}`);
}

async function etagOf(c: Client, calendar: CalendarRow, href: string, res: Response): Promise<string | null> {
  const header = res.headers.get("etag");
  if (header) return header;
  const objects = await c.fetchCalendarObjects({ calendar: davCalendar(calendar), objectUrls: [requestUrl(href)] });
  return objects[0]?.etag ?? null;
}

async function credentialsCtx(ctx: CalendarCtx) {
  return client(ctx.account, ctx.credentials);
}

export const caldavConnector: CalendarConnector = {
  async listCalendars(ctx) {
    const c = await credentialsCtx(ctx);
    const calendars = await c.fetchCalendars();
    return calendars
      .filter((cal) => !cal.components || cal.components.includes("VEVENT"))
      .map((cal, i): NormalizedCalendar => ({
        providerCalendarId: cal.url,
        name: displayName(cal.displayName),
        description: cal.description ?? null,
        color: cal.calendarColor?.slice(0, 7) ?? null,
        timezone: null,
        accessRole: "owner",
        isPrimary: i === 0,
        kind: i === 0 ? "default" : "regular",
        ctag: cal.ctag ?? null,
        defaultReminders: [],
      }));
  },

  async syncEvents(ctx, calendar, opts) {
    const c = await credentialsCtx(ctx);
    const current = (await c.fetchCalendars()).find((cal) => cal.url === calendar.providerCalendarId);
    if (!current) throw new Error("caldav_calendar_missing");
    if (opts.cursor && current.ctag && opts.cursor === current.ctag) return { events: [], deleted: [], cursor: opts.cursor, more: false, full: false };

    const listing = await c.calendarQuery({
      url: calendar.providerCalendarId!,
      props: { "d:getetag": {} },
      filters: {
        "c:comp-filter": {
          _attributes: { name: "VCALENDAR" },
          "c:comp-filter": { _attributes: { name: "VEVENT" }, "c:time-range": { _attributes: { start: icalStamp(opts.from), end: icalStamp(opts.to) } } },
        },
      },
      depth: "1",
    });
    const remote = new Map<string, string>();
    for (const r of listing) {
      if (!r.href || !r.ok) continue;
      const href = resolveHref(calendar.providerCalendarId!, r.href);
      if (href.replace(/\/$/, "") === resolveHref(calendar.providerCalendarId!, calendar.providerCalendarId!).replace(/\/$/, "")) continue;
      remote.set(href, String(r.props?.getetag ?? ""));
    }
    const known = opts.known ?? new Map<string, string | null>();
    const changed = [...remote].filter(([href, etag]) => !etag || known.get(href) !== etag).map(([href]) => href);
    const deleted = [...known.keys()].filter((href) => !remote.has(href));

    const events: NormalizedEvent[] = [];
    for (let i = 0; i < changed.length; i += MULTIGET_CHUNK) {
      const objects = await c.fetchCalendarObjects({
        calendar: davCalendar(calendar),
        objectUrls: changed.slice(i, i + MULTIGET_CHUNK).map(requestUrl),
        useMultiGet: true,
      });
      for (const o of objects) {
        if (!o.data) continue;
        try {
          events.push(...mapResource(resolveHref(calendar.providerCalendarId!, o.url), o.etag ?? null, String(o.data)));
        } catch {
          /* unparseable resource — skip, it'll retry when its etag changes */
        }
      }
    }
    return { events, deleted, cursor: current.ctag ?? null, more: false, full: false, replacedResources: changed };
  },

  async fetchEvent(ctx, calendar, providerEventId) {
    const c = await credentialsCtx(ctx);
    const href = providerEventId.split("#")[0];
    const objects = await c.fetchCalendarObjects({ calendar: davCalendar(calendar), objectUrls: [requestUrl(href)] });
    const o = objects[0];
    if (!o?.data) return null;
    return mapResource(href, o.etag ?? null, String(o.data));
  },

  async create(ctx, calendar, write) {
    const c = await credentialsCtx(ctx);
    const filename = `${write.event.uid.replace(/[^\w.@-]/g, "_")}.ics`;
    const res = await c.createCalendarObject({ calendar: davCalendar(calendar), filename, iCalString: resourceText(write), headers: { "if-none-match": "*" } });
    check(res);
    const href = resolveHref(calendar.providerCalendarId!.replace(/\/?$/, "/"), filename);
    return { providerEventId: href, etag: await etagOf(c, calendar, href, res) };
  },

  async update(ctx, calendar, write, etag) {
    const c = await credentialsCtx(ctx);
    const href = write.event.providerEventId!;
    const res = await c.updateCalendarObject({ calendarObject: { url: requestUrl(href), data: resourceText(write), etag: etag ?? undefined } });
    check(res);
    return { providerEventId: href, etag: await etagOf(c, calendar, href, res) };
  },

  async updateInstance(ctx, calendar, write, etag) {
    const c = await credentialsCtx(ctx);
    const href = write.master?.providerEventId;
    if (!href) throw new Error("master_not_pushed");
    const cancel = write.event.status === "cancelled";
    const res = await c.updateCalendarObject({
      calendarObject: { url: requestUrl(href), data: resourceText(write, { cancelInstance: cancel }), etag: (write.master?.etag ?? etag) || undefined },
    });
    check(res);
    const rid = write.event.originalStartDate ?? write.event.originalStartAt?.toISOString() ?? "";
    return { providerEventId: `${href}#${rid}`, etag: await etagOf(c, calendar, href, res) };
  },

  async remove(ctx, _calendar, providerEventId, etag) {
    const c = await credentialsCtx(ctx);
    const res = await c.deleteCalendarObject({ calendarObject: { url: requestUrl(providerEventId.split("#")[0]), etag: etag ?? undefined } });
    check(res);
  },

  async respond(ctx, calendar, write, status, comment) {
    const attendees = write.attendees.map((a) => (a.isSelf ? { ...a, status, comment } : a));
    const next = { ...write, attendees };
    return write.event.recurringEventId
      ? this.updateInstance(ctx, calendar, next, write.master?.etag ?? null)
      : this.update(ctx, calendar, next, write.event.etag);
  },
};
