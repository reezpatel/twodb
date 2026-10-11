import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { api } from "@/lib/api";
import type { Address } from "@/components/address-input/address-input";
import {
  addDays,
  calendarKeys,
  eventPath,
  fromWall,
  toWall,
  type CalendarItem,
  type CalendarSettings,
  type EventDetail,
  type Occurrence,
  type RecurrenceScope,
  type ReminderSpec,
} from "../calendar-api";
import type { EditorState } from "../use-calendar-scene";
import { buildRrule, parseRrule, type CustomRule, type RepeatPreset } from "./recurrence";

export interface Guest extends Address {
  optional: boolean;
}

export interface EditorValues {
  calendarId: string;
  title: string;
  isAllDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timezone: string;
  repeat: RepeatPreset;
  custom: CustomRule;
  location: string;
  conference: "none" | "meet" | "teams" | "link";
  conferenceUrl: string;
  guests: Guest[];
  useDefaultReminders: boolean;
  reminders: ReminderSpec[];
  transparency: "opaque" | "transparent";
  visibility: string;
  eventType: string;
  color: string;
  description: string;
  guestsCanModify: boolean;
  guestsCanInviteOthers: boolean;
  guestsCanSeeOthers: boolean;
}

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const toMinutes = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

function initialValues(
  state: EditorState,
  detail: EventDetail | undefined,
  settings: CalendarSettings | undefined,
  tz: string,
  defaultCalendarId: string | undefined,
): EditorValues {
  const duration = settings?.defaultDurationMin ?? 30;
  if (detail) {
    const e = detail.event;
    const occ = state.occurrence;
    const startIso = occ && !e.recurringEventId && e.rrule?.length ? occ.startAt : e.startAt;
    const endIso = occ && !e.recurringEventId && e.rrule?.length ? occ.endAt : e.endAt;
    const evTz = e.startTz ?? tz;
    const s = startIso ? toWall(startIso, evTz) : null;
    const en = endIso ? toWall(endIso, evTz) : null;
    const startDate = e.isAllDay ? (occ?.startDate ?? e.startDate!) : s!.date;
    const { preset, custom } = parseRrule(detail.master?.rrule ?? e.rrule, startDate);
    return {
      calendarId: e.calendarId,
      title: e.title,
      isAllDay: e.isAllDay,
      startDate,
      startTime: s ? hhmm(s.minutes) : "09:00",
      endDate: e.isAllDay ? addDays(occ?.endDate ?? e.endDate ?? addDays(startDate, 1), -1) : en!.date,
      endTime: en ? hhmm(en.minutes) : "10:00",
      timezone: evTz,
      repeat: preset,
      custom,
      location: e.location ?? "",
      conference: e.conference?.url
        ? e.conference.type === "meet"
          ? "meet"
          : e.conference.type === "teams"
            ? "teams"
            : "link"
        : e.conference?.create
          ? e.conference.type === "teams"
            ? "teams"
            : "meet"
          : "none",
      conferenceUrl: e.conference?.type === "custom" ? (e.conference.url ?? "") : "",
      guests: detail.attendees.filter((a) => !a.isSelf || !a.isOrganizer).map((a) => ({ name: a.name, address: a.email, optional: a.role === "optional" })),
      useDefaultReminders: detail.usesDefaultReminders,
      reminders: detail.reminders.map((r) => ({ method: r.method as "popup" | "email", minutes: r.minutes })),
      transparency: e.transparency === "transparent" ? "transparent" : "opaque",
      visibility: e.visibility,
      eventType: e.eventType,
      color: e.color ?? "",
      description: e.descriptionHtml ?? "",
      guestsCanModify: e.guestsCanModify,
      guestsCanInviteOthers: e.guestsCanInviteOthers,
      guestsCanSeeOthers: e.guestsCanSeeOthers,
    };
  }
  const init = state.initial ?? {};
  const now = toWall(new Date(), tz);
  const roundedStart = Math.ceil((now.minutes + 1) / 30) * 30;
  const s = init.startAt ? toWall(init.startAt, tz) : { date: now.date, minutes: roundedStart };
  const en = init.endAt ? toWall(init.endAt, tz) : { date: s.date, minutes: s.minutes + duration };
  const startDate = init.startDate ?? s.date;
  return {
    calendarId: init.calendarId ?? defaultCalendarId ?? "",
    title: init.title ?? "",
    isAllDay: !!init.isAllDay,
    startDate,
    startTime: hhmm(s.minutes),
    endDate: init.endDate ? addDays(init.endDate, -1) : en.minutes >= 1440 ? addDays(en.date, 1) : en.date,
    endTime: hhmm(Math.min(en.minutes, 1439)),
    timezone: tz,
    repeat: "none",
    custom: { freq: "WEEKLY", interval: 1, byday: [], end: "never", until: "", count: 10 },
    location: "",
    conference: "none",
    conferenceUrl: "",
    guests: [],
    useDefaultReminders: true,
    reminders: [],
    transparency: "opaque",
    visibility: "default",
    eventType: "default",
    color: "",
    description: "",
    guestsCanModify: false,
    guestsCanInviteOthers: true,
    guestsCanSeeOthers: true,
  };
}

export function toPayload(v: EditorValues, existingRrule: string[] | null) {
  const timed = !v.isAllDay;
  const start = timed ? fromWall(v.startDate, toMinutes(v.startTime), v.timezone) : null;
  let end = timed ? fromWall(v.endDate, toMinutes(v.endTime), v.timezone) : null;
  if (start && end && end <= start) end = new Date(start.getTime() + 30 * 60_000);
  const rule = buildRrule(v.repeat, v.startDate, v.custom);
  const exdates = (existingRrule ?? []).filter((l) => /^(EXDATE|RDATE)/i.test(l));
  const conference =
    v.conference === "none"
      ? null
      : v.conference === "link"
        ? { type: "custom" as const, url: v.conferenceUrl.trim() || null }
        : { type: v.conference, create: true };
  return {
    calendarId: v.calendarId,
    title: v.title.trim(),
    isAllDay: v.isAllDay,
    startAt: start?.toISOString() ?? null,
    endAt: end?.toISOString() ?? null,
    startDate: v.isAllDay ? v.startDate : null,
    endDate: v.isAllDay ? addDays(v.endDate < v.startDate ? v.startDate : v.endDate, 1) : null,
    startTz: timed ? v.timezone : null,
    endTz: timed ? v.timezone : null,
    rrule: rule ? [...rule, ...exdates] : null,
    location: v.location.trim() || null,
    conference,
    attendees: v.guests.map((g) => ({ email: g.address, name: g.name, role: g.optional ? "optional" : "required" })),
    reminders: v.useDefaultReminders ? null : v.reminders,
    transparency: v.transparency,
    visibility: v.visibility,
    eventType: v.eventType,
    color: v.color || null,
    descriptionHtml: v.description || null,
    guestsCanModify: v.guestsCanModify,
    guestsCanInviteOthers: v.guestsCanInviteOthers,
    guestsCanSeeOthers: v.guestsCanSeeOthers,
  };
}

interface Options {
  state: EditorState;
  tz: string;
  settings: CalendarSettings | undefined;
  calendars: CalendarItem[];
  defaultCalendarId: string | undefined;
  onSaved: (providerCalendar: boolean) => void;
  askScope: (occurrence: Occurrence, run: (scope: RecurrenceScope) => void) => void;
}

export function useEventEditorData(eventId: string | undefined) {
  return useQuery({ queryKey: calendarKeys.event(eventId ?? "new"), queryFn: () => api<EventDetail>(`/api/calendar/events/${eventId}`), enabled: !!eventId });
}

export function useEventEditor({ state, tz, settings, calendars, defaultCalendarId, onSaved, askScope }: Options, detail: EventDetail | undefined) {
  const queryClient = useQueryClient();
  const isEdit = !!state.eventId;

  const save = useMutation({
    mutationFn: async ({ values, scope }: { values: EditorValues; scope: RecurrenceScope }) => {
      const payload = toPayload(values, detail?.master?.rrule ?? detail?.event.rrule ?? null);
      if (!isEdit) return api<{ id: string }>("/api/calendar/events", { method: "POST", body: JSON.stringify(payload) });
      const occ = state.occurrence;
      const target = occ?.isRecurring && scope !== "this" && occ.seriesId ? occ.seriesId : state.eventId!;
      if (occ?.isRecurring && scope === "this") delete (payload as Partial<typeof payload>).rrule;
      return api<{ id: string }>(eventPath(target, occ?.isRecurring ? scope : undefined, occ?.isRecurring ? (occ.originalStart ?? occ.startAt) : null), {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (_d, { values }) => {
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      onSaved(!!calendars.find((c) => c.id === values.calendarId)?.accountId);
    },
  });

  const form = useForm({
    defaultValues: initialValues(state, detail, settings, tz, defaultCalendarId),
    onSubmit: async ({ value }) => {
      const occ = state.occurrence;
      if (isEdit && occ?.isRecurring) {
        await new Promise<void>((resolve, reject) => askScope(occ, (scope) => save.mutateAsync({ values: value, scope }).then(() => resolve(), reject)));
      } else await save.mutateAsync({ values: value, scope: "all" });
    },
  });

  return { form, save, isEdit };
}

export { toMinutes, hhmm };
