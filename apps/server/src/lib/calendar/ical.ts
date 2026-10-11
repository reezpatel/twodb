import ICAL from "ical.js";
import type { NormalizedAttendee, NormalizedEvent } from "./types";
import { safeTz, utcFromWall } from "./tz";

// iCalendar parse (ical.js) and serialize (hand-built; predictable output for
// CalDAV PUTs, iMIP mails and ICS exports). One parse path for CalDAV,
// subscriptions, .ics imports and invitations.

export interface ParsedIcs {
  method: string | null;
  calendarName: string | null;
  events: NormalizedEvent[];
}

const PARTSTAT: Record<string, string> = {
  ACCEPTED: "accepted",
  DECLINED: "declined",
  TENTATIVE: "tentative",
  DELEGATED: "delegated",
  "NEEDS-ACTION": "needs_action",
};
const ROLE: Record<string, string> = { "REQ-PARTICIPANT": "required", "OPT-PARTICIPANT": "optional", CHAIR: "chair", "NON-PARTICIPANT": "non_participant" };

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function textToHtml(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  if (/<\/?(p|br|div|a|b|i|ul|li)\b/i.test(text)) return text;
  return escapeHtml(text).replace(/\n/g, "<br>");
}

export function htmlToPlain(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mailto(value: unknown): string | null {
  const s = String(value ?? "").trim();
  const email = s.replace(/^mailto:/i, "").toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(email) ? email : null;
}

interface TimeValue {
  date?: string;
  at?: Date;
  tz?: string | null;
  floating?: boolean;
}

function readTime(prop: ICAL.Property | null): TimeValue | null {
  if (!prop) return null;
  const value = prop.getFirstValue() as ICAL.Time | null;
  if (!value || typeof value !== "object" || !("isDate" in value)) return null;
  if (value.isDate) return { date: `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}` };
  const tzid = prop.getParameter("tzid") as string | null;
  const isUtc = value.zone?.tzid === "UTC" || value.zone === ICAL.Timezone.utcTimezone;
  if (isUtc) return { at: value.toJSDate(), tz: null };
  if (tzid) {
    const tz = safeTz(tzid.replace(/^\/[^/]+\//, ""), "");
    if (tz) {
      const wall = new Date(Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second));
      return { at: utcFromWall(wall, tz), tz };
    }
    // Unknown TZID with an embedded VTIMEZONE: ical.js resolves it.
    try {
      return { at: value.toJSDate(), tz: null };
    } catch {
      /* fall through to floating */
    }
  }
  const wall = new Date(Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second));
  return { at: wall, tz: null, floating: true };
}

function recurrenceLines(comp: ICAL.Component): string[] | null {
  const lines: string[] = [];
  for (const name of ["rrule", "rdate", "exdate"]) {
    for (const prop of comp.getAllProperties(name)) lines.push(prop.toICALString());
  }
  return lines.length ? lines : null;
}

function conferenceOf(comp: ICAL.Component, location: string | null, description: string | null): NormalizedEvent["conference"] {
  const google = comp.getFirstPropertyValue("x-google-conference") as string | null;
  if (google) return { type: "meet", url: google };
  const teams = comp.getFirstPropertyValue("x-microsoft-skypeteamsmeetingurl") as string | null;
  if (teams) return { type: "teams", url: teams };
  const haystack = `${location ?? ""} ${description ?? ""}`;
  const meet = haystack.match(/https:\/\/meet\.google\.com\/[a-z-]+/i)?.[0];
  if (meet) return { type: "meet", url: meet };
  const team = haystack.match(/https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"<>]+/i)?.[0];
  if (team) return { type: "teams", url: team };
  const zoom = haystack.match(/https:\/\/[\w.-]*zoom\.us\/j\/[^\s"<>]+/i)?.[0];
  if (zoom) return { type: "custom", url: zoom };
  return null;
}

export function parseIcs(text: string): ParsedIcs {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const vtz of root.getAllSubcomponents("vtimezone")) {
    try {
      ICAL.TimezoneService.register(vtz);
    } catch {
      /* duplicate or malformed zone — the IANA mapping still applies */
    }
  }
  const method = (root.getFirstPropertyValue("method") as string | null)?.toUpperCase() ?? null;
  const calendarName = (root.getFirstPropertyValue("x-wr-calname") as string | null) ?? null;
  const events: NormalizedEvent[] = [];

  for (const comp of root.getAllSubcomponents("vevent")) {
    const uid = String(comp.getFirstPropertyValue("uid") ?? "").trim();
    if (!uid) continue;
    const start = readTime(comp.getFirstProperty("dtstart"));
    if (!start) continue;
    let end = readTime(comp.getFirstProperty("dtend"));
    const duration = comp.getFirstPropertyValue("duration") as ICAL.Duration | null;
    const isAllDay = !!start.date;
    if (!end && duration && start.at) end = { at: new Date(start.at.getTime() + duration.toSeconds() * 1000), tz: start.tz };
    if (!end && duration && start.date) {
      const d = new Date(`${start.date}T00:00:00Z`);
      d.setUTCSeconds(d.getUTCSeconds() + duration.toSeconds());
      end = { date: d.toISOString().slice(0, 10) };
    }
    if (!end)
      end = isAllDay
        ? { date: new Date(new Date(`${start.date}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10) }
        : { at: start.at, tz: start.tz };

    const recurrenceId = readTime(comp.getFirstProperty("recurrence-id"));
    const description = comp.getFirstPropertyValue("description") as string | null;
    const location = (comp.getFirstPropertyValue("location") as string | null) ?? null;
    const organizerProp = comp.getFirstProperty("organizer");
    const organizerEmail = organizerProp ? mailto(organizerProp.getFirstValue()) : null;
    const attendees: NormalizedAttendee[] = [];
    for (const a of comp.getAllProperties("attendee")) {
      const email = mailto(a.getFirstValue());
      if (!email) continue;
      const cutype = String(a.getParameter("cutype") ?? "").toUpperCase();
      attendees.push({
        email,
        name: (a.getParameter("cn") as string | null) ?? null,
        role: cutype === "ROOM" || cutype === "RESOURCE" ? "resource" : (ROLE[String(a.getParameter("role") ?? "REQ-PARTICIPANT").toUpperCase()] ?? "required"),
        status: PARTSTAT[String(a.getParameter("partstat") ?? "NEEDS-ACTION").toUpperCase()] ?? "needs_action",
        isOrganizer: email === organizerEmail,
      });
    }
    const status = String(comp.getFirstPropertyValue("status") ?? "CONFIRMED").toLowerCase();
    const klass = String(comp.getFirstPropertyValue("class") ?? "").toLowerCase();
    const lastModified = comp.getFirstPropertyValue("last-modified") as ICAL.Time | null;
    const alarms = comp.getAllSubcomponents("valarm").flatMap((alarm) => {
      const trigger = alarm.getFirstPropertyValue("trigger");
      if (!trigger || typeof trigger !== "object" || !("toSeconds" in trigger)) return [];
      const action = String(alarm.getFirstPropertyValue("action") ?? "DISPLAY").toUpperCase();
      return [
        {
          method: action === "EMAIL" ? ("email" as const) : ("popup" as const),
          minutes: Math.max(0, Math.round(-(trigger as ICAL.Duration).toSeconds() / 60)),
        },
      ];
    });

    events.push({
      providerEventId: recurrenceId ? `${uid}#${recurrenceId.date ?? recurrenceId.at?.toISOString()}` : uid,
      uid,
      sequence: Number(comp.getFirstPropertyValue("sequence") ?? 0),
      recurringProviderEventId: recurrenceId ? uid : null,
      originalStartAt: recurrenceId ? (recurrenceId.at ?? new Date(`${recurrenceId.date}T00:00:00Z`)) : null,
      originalStartDate: recurrenceId?.date ?? null,
      status: status === "cancelled" ? "cancelled" : status === "tentative" ? "tentative" : "confirmed",
      title: String(comp.getFirstPropertyValue("summary") ?? ""),
      descriptionHtml: textToHtml(description),
      location,
      isAllDay,
      startAt: start.at ?? null,
      endAt: end.at ?? null,
      startDate: start.date ?? null,
      endDate: end.date ?? null,
      startTz: start.tz ?? null,
      endTz: end.tz ?? start.tz ?? null,
      isFloating: !!start.floating,
      rrule: recurrenceId ? null : recurrenceLines(comp),
      transparency: String(comp.getFirstPropertyValue("transp") ?? "OPAQUE").toUpperCase() === "TRANSPARENT" ? "transparent" : "opaque",
      visibility: klass === "private" ? "private" : klass === "confidential" ? "confidential" : klass === "public" ? "public" : "default",
      organizer: organizerEmail ? { email: organizerEmail, name: (organizerProp?.getParameter("cn") as string | null) ?? null } : null,
      attendees,
      conference: conferenceOf(comp, location, description),
      reminders: alarms.length ? alarms : null,
      providerUpdatedAt: lastModified ? lastModified.toJSDate() : null,
    });
  }
  return { method, calendarName, events };
}

// ── serialize ────────────────────────────────────────────────────────────────

function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, "utf8") > (out.length ? 74 : 75)) {
      out.push(current);
      current = ch;
    } else current += ch;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function utcStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function wallStamp(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}T${get("hour")}${get("minute")}${get("second")}`;
}

function timeProp(
  name: string,
  at: Date | null | undefined,
  date: string | null | undefined,
  tz: string | null | undefined,
  floating?: boolean,
): string | null {
  if (date) return `${name};VALUE=DATE:${date.replace(/-/g, "")}`;
  if (!at) return null;
  if (floating) return `${name}:${utcStamp(at).replace(/Z$/, "")}`;
  if (tz && tz !== "UTC") return `${name};TZID=${tz}:${wallStamp(at, tz)}`;
  return `${name}:${utcStamp(at)}`;
}

const PARTSTAT_OUT: Record<string, string> = {
  accepted: "ACCEPTED",
  declined: "DECLINED",
  tentative: "TENTATIVE",
  delegated: "DELEGATED",
  needs_action: "NEEDS-ACTION",
};
const ROLE_OUT: Record<string, string> = {
  required: "REQ-PARTICIPANT",
  optional: "OPT-PARTICIPANT",
  chair: "CHAIR",
  non_participant: "NON-PARTICIPANT",
  resource: "REQ-PARTICIPANT",
};

export interface SerializableEvent {
  uid: string;
  sequence?: number;
  status?: string;
  title: string;
  descriptionHtml?: string | null;
  location?: string | null;
  isAllDay: boolean;
  startAt?: Date | null;
  endAt?: Date | null;
  startDate?: string | null;
  endDate?: string | null;
  startTz?: string | null;
  endTz?: string | null;
  isFloating?: boolean;
  rrule?: string[] | null;
  originalStartAt?: Date | null;
  originalStartDate?: string | null;
  transparency?: string;
  visibility?: string;
  organizer?: { email: string; name?: string | null } | null;
  attendees?: NormalizedAttendee[];
  conference?: { url: string | null } | null;
  reminders?: { method: string; minutes: number }[] | null;
  updatedAt?: Date;
}

function veventLines(e: SerializableEvent): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${utcStamp(new Date())}`];
  if (e.updatedAt) lines.push(`LAST-MODIFIED:${utcStamp(e.updatedAt)}`);
  lines.push(`SEQUENCE:${e.sequence ?? 0}`);
  const start = timeProp("DTSTART", e.startAt, e.isAllDay ? e.startDate : null, e.startTz, e.isFloating);
  const end = timeProp("DTEND", e.endAt, e.isAllDay ? e.endDate : null, e.endTz ?? e.startTz, e.isFloating);
  if (start) lines.push(start);
  if (end) lines.push(end);
  if (e.originalStartAt || e.originalStartDate) {
    const rid = timeProp(
      "RECURRENCE-ID",
      e.originalStartAt,
      e.isAllDay ? (e.originalStartDate ?? e.originalStartAt?.toISOString().slice(0, 10)) : null,
      e.startTz,
      e.isFloating,
    );
    if (rid) lines.push(rid);
  }
  for (const r of e.rrule ?? []) lines.push(r);
  lines.push(`SUMMARY:${escapeText(e.title || "")}`);
  const plain = htmlToPlain(e.descriptionHtml);
  if (plain) lines.push(`DESCRIPTION:${escapeText(plain)}`);
  if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
  if (e.status) lines.push(`STATUS:${e.status.toUpperCase()}`);
  lines.push(`TRANSP:${e.transparency === "transparent" ? "TRANSPARENT" : "OPAQUE"}`);
  if (e.visibility && e.visibility !== "default") lines.push(`CLASS:${e.visibility.toUpperCase()}`);
  if (e.conference?.url) lines.push(`URL:${e.conference.url}`);
  if (e.organizer) lines.push(`ORGANIZER${e.organizer.name ? `;CN=${JSON.stringify(e.organizer.name)}` : ""}:mailto:${e.organizer.email}`);
  for (const a of e.attendees ?? []) {
    const params = [
      a.name ? `CN=${JSON.stringify(a.name)}` : null,
      a.role === "resource" ? "CUTYPE=RESOURCE" : null,
      `ROLE=${ROLE_OUT[a.role ?? "required"] ?? "REQ-PARTICIPANT"}`,
      `PARTSTAT=${PARTSTAT_OUT[a.status ?? "needs_action"] ?? "NEEDS-ACTION"}`,
      a.status === "needs_action" || !a.status ? "RSVP=TRUE" : null,
    ].filter(Boolean);
    lines.push(`ATTENDEE;${params.join(";")}:mailto:${a.email}`);
  }
  for (const r of e.reminders ?? []) {
    lines.push(
      "BEGIN:VALARM",
      `ACTION:${r.method === "email" ? "EMAIL" : "DISPLAY"}`,
      `TRIGGER:-PT${r.minutes}M`,
      `DESCRIPTION:${escapeText(e.title || "Reminder")}`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT");
  return lines;
}

export function serializeIcs(events: SerializableEvent[], opts: { method?: string; name?: string } = {}): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//twodb//calendar//EN", "CALSCALE:GREGORIAN"];
  if (opts.method) lines.push(`METHOD:${opts.method}`);
  if (opts.name) lines.push(`X-WR-CALNAME:${escapeText(opts.name)}`);
  for (const e of events) lines.push(...veventLines(e));
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
