import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { wsUrl } from "@/lib/native";

// ── types ────────────────────────────────────────────────────────────────────

export type CalendarRole = "owner" | "editor" | "viewer" | "free_busy";
export type CalendarView = "day" | "4day" | "week" | "month" | "year" | "agenda";
export type RecurrenceScope = "this" | "following" | "all";

export interface ReminderSpec {
  method: "popup" | "email";
  minutes: number;
  allDay?: boolean;
}

export interface CalendarItem {
  id: string;
  accountId: string | null;
  accountAddress: string | null;
  name: string;
  description: string | null;
  color: string;
  timezone: string;
  kind: string;
  accessRole: string;
  role: CalendarRole;
  canApprove: boolean;
  isPrimary: boolean;
  syncEnabled: boolean;
  hidden: boolean;
  sortOrder: number;
  defaultReminders: ReminderSpec[];
  allowedConference: string[];
  subscriptionUrl: string | null;
  hasFeed: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  ownerUserId: string;
}

export interface Occurrence {
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
  pushState: "none" | "awaiting_approval" | "pending" | "failed" | "conflict";
  localOnly: boolean;
  busyOnly: boolean;
}

export interface Attendee {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  comment: string | null;
  isOrganizer: boolean;
  isSelf: boolean;
}

export interface EventDetail {
  event: {
    id: string;
    calendarId: string;
    uid: string;
    title: string;
    descriptionHtml: string | null;
    location: string | null;
    isAllDay: boolean;
    startAt: string | null;
    endAt: string | null;
    startDate: string | null;
    endDate: string | null;
    startTz: string | null;
    endTz: string | null;
    rrule: string[] | null;
    recurringEventId: string | null;
    originalStartAt: string | null;
    status: string;
    transparency: string;
    visibility: string;
    eventType: string;
    color: string | null;
    organizer: { email: string; name?: string | null; self?: boolean } | null;
    conference: { type: string; url: string | null; create?: boolean } | null;
    guestsCanModify: boolean;
    guestsCanInviteOthers: boolean;
    guestsCanSeeOthers: boolean;
    pushState: Occurrence["pushState"];
    localOnly: boolean;
    localOnlyFields: Record<string, { providerValue: unknown; remoteValue?: unknown }>;
    localDeletedAt: string | null;
    deletedAt: string | null;
    meetingRecordingId: string | null;
    source: string;
  };
  master: { id: string; rrule: string[] | null; title: string; startAt: string | null; startDate: string | null } | null;
  recurrenceText: string | null;
  calendar: { id: string; name: string; color: string; accountId: string | null; kind: string; timezone: string };
  role: CalendarRole;
  canEdit: boolean;
  canApprove: boolean;
  attendees: Attendee[];
  reminders: { id: string; method: string; minutes: number; personal: boolean }[];
  usesDefaultReminders: boolean;
  attachments: { id: string; title: string; url: string | null; mimeType: string | null }[];
  pending: { id: string; op: string; status: string; fields: string[]; remoteChangedFields: string[]; remoteDeleted: boolean; lastError: string | null }[];
  selfAddresses: string[];
}

export interface PendingChange {
  id: string;
  op: "create" | "update" | "delete" | "move" | "rsvp" | "cancel_instance";
  status: string;
  fields: string[];
  diff: Record<string, { before: unknown; after: unknown }>;
  impact: { emailsGuests?: number; createsConference?: boolean; respondsToOrganizer?: boolean };
  payload: Record<string, unknown>;
  recurrenceScope: RecurrenceScope;
  occurrenceStart: string | null;
  remoteChangedFields: string[];
  remoteDeleted: boolean;
  lastError: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  accountId: string;
  calendarId: string;
  eventId: string;
  title: string;
  isAllDay: boolean;
  startAt: string | null;
  endAt: string | null;
  startDate: string | null;
  endDate: string | null;
  startTz: string | null;
  calendarName: string;
  calendarColor: string;
  accountAddress: string;
  editorName: string | null;
  deciderName: string | null;
  canApprove: boolean;
}

export interface CalendarSettings {
  timezone: string;
  secondaryTimezone: string | null;
  weekStart: 0 | 1 | 6;
  defaultView: CalendarView;
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

export interface CalendarMeta {
  google: { configured: boolean };
  microsoft: { configured: boolean };
  webhooksAvailable: boolean;
  storageReady: boolean;
  holidayPresets: { id: string; label: string; url: string }[];
  isAdmin: boolean;
  accounts: {
    id: string;
    address: string;
    kind: string;
    capabilities: string[];
    calendarState: string;
    calendarError: string | null;
    calendarImportState: string;
    calendarImportProgress: Record<string, number>;
    syncMode: string;
  }[];
}

export interface ReminderEvent {
  type: "reminder";
  deliveryId: string;
  eventId: string;
  occurrenceStart: string;
  title: string;
  location: string | null;
  conferenceUrl: string | null;
  isAllDay: boolean;
  minutes: number;
  calendarName: string;
}

// ── queries ──────────────────────────────────────────────────────────────────

export const calendarKeys = {
  all: ["calendar"] as const,
  meta: ["calendar", "meta"] as const,
  settings: ["calendar", "settings"] as const,
  calendars: ["calendar", "calendars"] as const,
  occurrences: (from: string, to: string) => ["calendar", "occurrences", from, to] as const,
  event: (id: string) => ["calendar", "event", id] as const,
  pending: (history: boolean, filter: string) => ["calendar", "pending", history, filter] as const,
  pendingCount: ["calendar", "pending-count"] as const,
  trash: ["calendar", "trash"] as const,
  search: (q: string) => ["calendar", "search", q] as const,
};

export const useCalendarMeta = () => useQuery({ queryKey: calendarKeys.meta, queryFn: () => api<CalendarMeta>("/api/calendar/meta") });
export const useCalendars = () => useQuery({ queryKey: calendarKeys.calendars, queryFn: () => api<CalendarItem[]>("/api/calendar/calendars") });
export const useCalendarSettings = () => useQuery({ queryKey: calendarKeys.settings, queryFn: () => api<CalendarSettings>("/api/calendar/settings") });
export const usePendingCount = () =>
  useQuery({
    queryKey: calendarKeys.pendingCount,
    queryFn: () => api<{ awaiting: number; failed: number }>("/api/calendar/pending/count"),
    refetchInterval: 60_000,
  });

export function eventPath(id: string, scope?: RecurrenceScope, occurrence?: string | null) {
  const params = new URLSearchParams();
  if (scope) params.set("scope", scope);
  if (occurrence) params.set("occurrence", occurrence);
  const qs = params.toString();
  return `/api/calendar/events/${id}${qs ? `?${qs}` : ""}`;
}

/** Live updates: events, Pending push, reminders. */
export function useCalendarSocket(onReminder?: (r: ReminderEvent) => void) {
  const queryClient = useQueryClient();
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 1000;
    let ping: ReturnType<typeof setInterval> | null = null;
    const connect = () => {
      ws = new WebSocket(wsUrl("/api/calendar/ws"));
      ws.onopen = () => {
        retry = 1000;
        ping = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send('{"type":"ping"}'), 25_000);
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(String(e.data)) as { type: string; eventIds?: string[] };
        if (msg.type === "event.changed") {
          void queryClient.invalidateQueries({ queryKey: ["calendar", "occurrences"] });
          for (const id of msg.eventIds ?? []) void queryClient.invalidateQueries({ queryKey: calendarKeys.event(id) });
        } else if (msg.type === "pending.updated") {
          void queryClient.invalidateQueries({ queryKey: ["calendar", "pending"] });
          void queryClient.invalidateQueries({ queryKey: calendarKeys.pendingCount });
          void queryClient.invalidateQueries({ queryKey: ["calendar", "occurrences"] });
          for (const id of msg.eventIds ?? []) void queryClient.invalidateQueries({ queryKey: calendarKeys.event(id) });
        } else if (msg.type === "reminder") onReminder?.(msg as unknown as ReminderEvent);
      };
      ws.onclose = () => {
        if (ping) clearInterval(ping);
        if (!closed) setTimeout(connect, (retry = Math.min(retry * 2, 30_000)));
      };
    };
    connect();
    return () => {
      closed = true;
      if (ping) clearInterval(ping);
      ws?.close();
    };
  }, [queryClient, onReminder]);
}

// ── time zone + date helpers (display happens in the user's calendar tz) ─────

export function browserTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(tz, f);
  }
  return f;
}

export interface Wall {
  date: string;
  minutes: number;
}

/** Day key + minutes after midnight of an instant in tz. */
export function toWall(iso: string | Date, tz: string): Wall {
  const parts = partsFormatter(tz).formatToParts(typeof iso === "string" ? new Date(iso) : iso);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Instant for a wall date + minutes in tz. */
export function fromWall(date: string, minutes: number, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  const offset = (t: number) => {
    const w = toWall(new Date(t), tz);
    const [wy, wm, wd] = w.date.split("-").map(Number);
    return Date.UTC(wy, wm - 1, wd, Math.floor(w.minutes / 60), w.minutes % 60) - Math.floor(t / 60_000) * 60_000;
  };
  let t = guess - offset(guess);
  const second = guess - offset(t);
  if (second !== t) t = second;
  return new Date(t);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function startOfWeek(date: string, weekStart: number): string {
  return addDays(date, -((weekday(date) - weekStart + 7) % 7));
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(date: string, n: number): string {
  const d = new Date(`${startOfMonth(date)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

export function isoWeek(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - first.getTime()) / 86_400_000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
}

export function formatDay(date: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString([], { ...opts, timeZone: "UTC" });
}

export function formatMinutes(minutes: number): string {
  const d = new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60));
  return d.toLocaleTimeString([], { hour: "numeric", minute: minutes % 60 ? "2-digit" : undefined, timeZone: "UTC" });
}

export function formatTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: tz });
}

export function formatRange(
  o: { isAllDay: boolean; startAt: string | null; endAt: string | null; startDate: string | null; endDate: string | null },
  tz: string,
): string {
  if (o.isAllDay && o.startDate) {
    const last = o.endDate ? addDays(o.endDate, -1) : o.startDate;
    const a = formatDay(o.startDate, { weekday: "short", month: "short", day: "numeric" });
    return last === o.startDate ? `${a} · all day` : `${a} – ${formatDay(last, { weekday: "short", month: "short", day: "numeric" })}`;
  }
  if (!o.startAt) return "";
  const s = toWall(o.startAt, tz);
  const e = o.endAt ? toWall(o.endAt, tz) : s;
  const day = formatDay(s.date, { weekday: "short", month: "short", day: "numeric" });
  const end =
    e.date === s.date
      ? formatTime(o.endAt ?? o.startAt, tz)
      : `${formatDay(e.date, { month: "short", day: "numeric" })}, ${formatTime(o.endAt ?? o.startAt, tz)}`;
  return `${day} · ${formatTime(o.startAt, tz)} – ${end}`;
}

export function todayIn(tz: string): string {
  return toWall(new Date(), tz).date;
}

export const COMMON_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Istanbul",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function timezoneOptions(extra: (string | null | undefined)[] = []): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : COMMON_TIMEZONES;
  return [...new Set([...extra.filter((v): v is string => !!v), ...all])];
}
