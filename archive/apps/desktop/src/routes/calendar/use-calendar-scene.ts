import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { api } from "@/lib/api";
import {
  addDays,
  addMonths,
  browserTz,
  calendarKeys,
  eventPath,
  fromWall,
  startOfMonth,
  startOfWeek,
  todayIn,
  toWall,
  useCalendarMeta,
  useCalendars,
  useCalendarSettings,
  useCalendarSocket,
  usePendingCount,
  type CalendarView,
  type Occurrence,
  type RecurrenceScope,
  type ReminderEvent,
} from "./calendar-api";

export type Panel = "calendar" | "pending" | "trash" | "search";

export interface EditorState {
  eventId?: string;
  occurrence?: Occurrence | null;
  /** Prefill for new events (from drag-create or quick create). */
  initial?: { calendarId?: string; startAt?: string; endAt?: string; startDate?: string; endDate?: string; isAllDay?: boolean; title?: string };
}

export interface ScopeRequest {
  title: string;
  allowFollowing: boolean;
  run: (scope: RecurrenceScope) => void;
}

export function rangeFor(view: CalendarView, cursor: string, weekStart: number): { start: string; end: string } {
  switch (view) {
    case "day":
      return { start: cursor, end: addDays(cursor, 1) };
    case "4day":
      return { start: cursor, end: addDays(cursor, 4) };
    case "week": {
      const start = startOfWeek(cursor, weekStart);
      return { start, end: addDays(start, 7) };
    }
    case "month": {
      const start = startOfWeek(startOfMonth(cursor), weekStart);
      return { start, end: addDays(start, 42) };
    }
    case "year":
      return { start: `${cursor.slice(0, 4)}-01-01`, end: `${Number(cursor.slice(0, 4)) + 1}-01-01` };
    case "agenda":
      return { start: cursor, end: addDays(cursor, 30) };
  }
}

function step(view: CalendarView, cursor: string, dir: 1 | -1): string {
  switch (view) {
    case "day":
      return addDays(cursor, dir);
    case "4day":
      return addDays(cursor, 4 * dir);
    case "week":
      return addDays(cursor, 7 * dir);
    case "month":
      return addMonths(cursor, dir);
    case "year":
      return `${Number(cursor.slice(0, 4)) + dir}${cursor.slice(4)}`;
    case "agenda":
      return addDays(cursor, 30 * dir);
  }
}

export function useCalendarScene() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const settings = useCalendarSettings();
  const calendars = useCalendars();
  const meta = useCalendarMeta();
  const pendingCount = usePendingCount();
  const tz = settings.data?.timezone || browserTz();
  const weekStart = settings.data?.weekStart ?? 1;

  const [view, setViewState] = useState<CalendarView | null>(null);
  const [cursor, setCursor] = useState(() => todayIn(tz));
  const [panel, setPanel] = useState<Panel>("calendar");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Occurrence | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [scopeRequest, setScopeRequest] = useState<ScopeRequest | null>(null);
  const [reminders, setReminders] = useState<ReminderEvent[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const effectiveView = view ?? settings.data?.defaultView ?? "week";

  const onReminder = useCallback(
    (r: ReminderEvent) => {
      setReminders((list) => [...list.filter((x) => x.deliveryId !== r.deliveryId), r]);
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && settings.data?.desktopNotifications !== false) {
        new Notification(r.title, { body: r.minutes ? `In ${r.minutes} min${r.location ? ` · ${r.location}` : ""}` : "Starting now", tag: r.deliveryId });
      }
    },
    [settings.data?.desktopNotifications],
  );
  useCalendarSocket(onReminder);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default" && settings.data?.desktopNotifications)
      void Notification.requestPermission();
  }, [settings.data?.desktopNotifications]);

  const visibleCalendars = useMemo(() => (calendars.data ?? []).filter((c) => !c.hidden), [calendars.data]);
  const visibleIds = visibleCalendars.map((c) => c.id).join(",");
  const range = rangeFor(effectiveView, cursor, weekStart);
  const fromIso = fromWall(range.start, 0, tz).toISOString();
  const toIso = fromWall(range.end, 0, tz).toISOString();

  const occurrences = useQuery({
    queryKey: [...calendarKeys.occurrences(fromIso, toIso), visibleIds],
    queryFn: () => api<Occurrence[]>(`/api/calendar/occurrences?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&calendarIds=${visibleIds}`),
    enabled: !!calendars.data && visibleIds.length > 0,
    placeholderData: (prev) => prev,
  });

  const showDeclined = settings.data?.showDeclined ?? false;
  const items = useMemo(() => (occurrences.data ?? []).filter((o) => showDeclined || o.selfStatus !== "declined"), [occurrences.data, showDeclined]);

  const search = useQuery({
    queryKey: calendarKeys.search(query.trim()),
    queryFn: () =>
      api<
        {
          id: string;
          calendarId: string;
          title: string;
          location: string | null;
          isAllDay: boolean;
          startAt: string | null;
          endAt: string | null;
          startDate: string | null;
          endDate: string | null;
        }[]
      >(`/api/calendar/search?q=${encodeURIComponent(query.trim())}`),
    enabled: panel === "search" && query.trim().length > 1,
  });

  // Deep link: /apps/calendar?event=<id>
  const linkedEvent = params.get("event");
  useEffect(() => {
    if (!linkedEvent) return;
    void api<{
      event: {
        id: string;
        calendarId: string;
        startAt: string | null;
        startDate: string | null;
        isAllDay: boolean;
        endAt: string | null;
        endDate: string | null;
        title: string;
      };
    }>(`/api/calendar/events/${linkedEvent}`).then((d) => {
      const e = d.event;
      setCursor(e.startDate ?? (e.startAt ? toWall(e.startAt, tz).date : cursor));
      setSelected({
        key: e.id,
        eventId: e.id,
        seriesId: null,
        calendarId: e.calendarId,
        title: e.title,
        location: null,
        isAllDay: e.isAllDay,
        startAt: e.startAt ?? `${e.startDate}T00:00:00Z`,
        endAt: e.endAt ?? `${e.endDate}T00:00:00Z`,
        startDate: e.startDate,
        endDate: e.endDate,
        originalStart: null,
        status: "confirmed",
        transparency: "opaque",
        eventType: "default",
        color: null,
        isRecurring: false,
        attendeeCount: 0,
        selfStatus: null,
        hasConference: false,
        pushState: "none",
        localOnly: false,
        busyOnly: false,
      });
      setParams({}, { replace: true });
    });
  }, [linkedEvent]);

  const invalidateEvents = () => {
    void queryClient.invalidateQueries({ queryKey: ["calendar", "occurrences"] });
    void queryClient.invalidateQueries({ queryKey: calendarKeys.pendingCount });
    void queryClient.invalidateQueries({ queryKey: ["calendar", "pending"] });
  };

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast((t) => (t === message ? null : t)), 4000);
  };

  const toggleCalendar = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) =>
      api(`/api/calendar/calendars/${id}`, { method: "PATCH", body: JSON.stringify({ hidden }) }),
    onMutate: ({ id, hidden }) => {
      queryClient.setQueryData(calendarKeys.calendars, (list: typeof calendars.data) => list?.map((c) => (c.id === id ? { ...c, hidden } : c)));
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: calendarKeys.calendars }),
  });

  const moveTime = useMutation({
    mutationFn: ({ occurrence, patch, scope }: { occurrence: Occurrence; patch: Record<string, unknown>; scope: RecurrenceScope }) =>
      api(
        eventPath(
          occurrence.seriesId && scope !== "this" ? occurrence.seriesId : occurrence.eventId,
          occurrence.isRecurring ? scope : undefined,
          occurrence.originalStart ?? occurrence.startAt,
        ),
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      ),
    onSuccess: (_d, { occurrence }) => {
      invalidateEvents();
      if (calendarFor(occurrence.calendarId)?.accountId) flash("Change saved — waiting in Pending push for approval");
    },
    onError: (e: Error) => flash(e.message),
  });

  const removeEvent = useMutation({
    mutationFn: ({ occurrence, scope }: { occurrence: Occurrence; scope: RecurrenceScope }) =>
      api(
        eventPath(
          occurrence.isRecurring && scope !== "this" && occurrence.seriesId ? occurrence.seriesId : occurrence.eventId,
          occurrence.isRecurring ? scope : undefined,
          occurrence.originalStart ?? occurrence.startAt,
        ),
        { method: "DELETE" },
      ),
    onSuccess: (_d, { occurrence }) => {
      setSelected(null);
      invalidateEvents();
      void queryClient.invalidateQueries({ queryKey: calendarKeys.trash });
      flash(calendarFor(occurrence.calendarId)?.accountId ? "Deleted here — the provider delete waits in Pending push" : "Event moved to trash");
    },
    onError: (e: Error) => flash(e.message),
  });

  const calendarFor = (id: string) => (calendars.data ?? []).find((c) => c.id === id);

  /** Runs an action on an occurrence, asking "this / following / all" first when it's part of a series. */
  const withScope = (occurrence: Occurrence, title: string, run: (scope: RecurrenceScope) => void, opts: { allowFollowing?: boolean } = {}) => {
    if (!occurrence.isRecurring) run("all");
    else setScopeRequest({ title, allowFollowing: opts.allowFollowing ?? true, run });
  };

  const writableCalendars = useMemo(
    () => (calendars.data ?? []).filter((c) => (c.role === "owner" || c.role === "editor") && c.kind !== "subscription"),
    [calendars.data],
  );
  const defaultCalendarId =
    settings.data?.defaultCalendarId && writableCalendars.some((c) => c.id === settings.data?.defaultCalendarId)
      ? settings.data.defaultCalendarId
      : (writableCalendars.find((c) => !c.accountId && c.isPrimary)?.id ?? writableCalendars[0]?.id);

  return {
    tz,
    weekStart,
    settings,
    calendars,
    meta,
    pendingCount,
    view: effectiveView,
    setView: (v: CalendarView) => {
      setViewState(v);
      setPanel("calendar");
    },
    cursor,
    setCursor,
    range,
    today: todayIn(tz),
    prev: () => setCursor((c) => step(effectiveView, c, -1)),
    next: () => setCursor((c) => step(effectiveView, c, 1)),
    goToday: () => setCursor(todayIn(tz)),
    panel,
    setPanel,
    query,
    setQuery,
    search,
    occurrences,
    items,
    selected,
    setSelected,
    editor,
    openEditor: (state: EditorState) => {
      setSelected(null);
      setEditor(state);
    },
    closeEditor: () => setEditor(null),
    scopeRequest,
    setScopeRequest,
    withScope,
    reminders,
    dismissReminder: (id: string) => setReminders((list) => list.filter((r) => r.deliveryId !== id)),
    toast,
    flash,
    toggleCalendar,
    moveTime,
    removeEvent,
    calendarFor,
    writableCalendars,
    defaultCalendarId,
    invalidateEvents,
  };
}

export type CalendarSceneState = ReturnType<typeof useCalendarScene>;
