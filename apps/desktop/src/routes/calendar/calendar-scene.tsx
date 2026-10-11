import { useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, ChevronLeft, ChevronRight, CloudUpload, Loader2, Plus, Search, Settings, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SideNav, SideNavFooter, SideNavGroup, SideNavItem } from "@/components/side-nav";
import { addDays, daysBetween, formatDay, formatRange, toWall, type CalendarView, type Occurrence, type PendingChange } from "./calendar-api";
import { EventDetails } from "./event/event-details";
import { EventEditor } from "./event/event-editor";
import { ScopeDialog } from "./event/scope-dialog";
import { PendingPush } from "./pending/pending-push";
import { TrashPanel } from "./panels/trash-panel";
import { ReminderToasts } from "./reminders/reminder-toasts";
import { CalendarList } from "./sidebar/calendar-list";
import { useCalendarScene } from "./use-calendar-scene";
import { useCalendarShortcuts } from "./use-calendar-shortcuts";
import { AgendaView } from "./views/agenda-view";
import { MiniMonth } from "./views/mini-month";
import { MonthView } from "./views/month-view";
import { TimeGrid } from "./views/time-grid";

const VIEWS: { id: CalendarView; label: string; key: string }[] = [
  { id: "day", label: "Day", key: "D" },
  { id: "4day", label: "4 days", key: "X" },
  { id: "week", label: "Week", key: "W" },
  { id: "month", label: "Month", key: "M" },
  { id: "year", label: "Year", key: "Y" },
  { id: "agenda", label: "Schedule", key: "A" },
];

function occurrenceFromPending(row: PendingChange): Occurrence {
  return {
    key: row.eventId,
    eventId: row.eventId,
    seriesId: null,
    calendarId: row.calendarId,
    title: row.title,
    location: null,
    isAllDay: row.isAllDay,
    startAt: row.startAt ?? `${row.startDate}T00:00:00Z`,
    endAt: row.endAt ?? `${row.endDate}T00:00:00Z`,
    startDate: row.startDate,
    endDate: row.endDate,
    originalStart: row.occurrenceStart,
    status: "confirmed",
    transparency: "opaque",
    eventType: "default",
    color: null,
    isRecurring: false,
    attendeeCount: 0,
    selfStatus: null,
    hasConference: false,
    pushState: "awaiting_approval",
    localOnly: false,
    busyOnly: false,
  };
}

export function CalendarScene() {
  const s = useCalendarScene();
  useCalendarShortcuts(s);
  const [miniMonth, setMiniMonth] = useState<string | null>(null);
  const calendarsById = useMemo(() => new Map((s.calendars.data ?? []).map((c) => [c.id, c])), [s.calendars.data]);
  const settings = s.settings.data;
  const hideWeekends = settings ? !settings.showWeekends : false;

  const days = useMemo(() => {
    if (!["day", "4day", "week"].includes(s.view)) return [];
    const all = Array.from({ length: daysBetween(s.range.start, s.range.end) }, (_, i) => addDays(s.range.start, i));
    return s.view === "week" && hideWeekends ? all.filter((d) => ![0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())) : all;
  }, [s.view, s.range.start, s.range.end, hideWeekends]);

  const title =
    s.view === "year"
      ? s.cursor.slice(0, 4)
      : s.view === "month"
        ? formatDay(s.cursor, { month: "long", year: "numeric" })
        : s.view === "day"
          ? formatDay(s.cursor, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
          : `${formatDay(s.range.start, { month: "short", day: "numeric" })} – ${formatDay(addDays(s.range.end, -1), { month: "short", day: "numeric", year: "numeric" })}`;

  const canEdit = (o: Occurrence) =>
    !o.busyOnly && ["owner", "editor"].includes(calendarsById.get(o.calendarId)?.role ?? "") && calendarsById.get(o.calendarId)?.kind !== "subscription";
  const busyDays = useMemo(() => new Set(s.items.map((o) => (o.isAllDay ? o.startDate! : toWall(o.startAt, s.tz).date))), [s.items, s.tz]);

  const onMove = (o: Occurrence, start: Date, end: Date) =>
    s.withScope(o, "Change", (scope) => s.moveTime.mutate({ occurrence: o, scope, patch: { startAt: start.toISOString(), endAt: end.toISOString() } }));
  const openCreate = (initial: NonNullable<Parameters<typeof s.openEditor>[0]["initial"]>) =>
    s.openEditor({ initial: { calendarId: s.defaultCalendarId, ...initial } });

  if (s.calendars.isLoading || s.settings.isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="text-muted-foreground animate-spin" />
      </div>
    );
  }

  const pendingTotal = (s.pendingCount.data?.awaiting ?? 0) + (s.pendingCount.data?.failed ?? 0);
  const showDetails = !!s.selected && s.panel === "calendar";

  return (
    <div
      className={`bg-background relative grid h-full min-h-0 grid-cols-1 overflow-hidden ${showDetails ? "lg:grid-cols-[240px_1fr_380px]" : "lg:grid-cols-[240px_1fr]"}`}
    >
      <SideNav className="w-[240px]">
        <Button onClick={() => s.openEditor({})} disabled={!s.writableCalendars.length}>
          <Plus /> Create
        </Button>
        <MiniMonth
          month={miniMonth ?? s.cursor}
          today={s.today}
          weekStart={s.weekStart}
          selected={s.view === "month" || s.view === "year" ? null : s.range}
          busyDays={busyDays}
          onMonth={setMiniMonth}
          onPick={(day) => {
            s.setCursor(day);
            setMiniMonth(null);
            if (s.view === "year" || s.panel !== "calendar") s.setView("day");
          }}
        />
        <SideNavGroup separated>
          <SideNavItem
            label="Pending push"
            icon={CloudUpload}
            count={pendingTotal || undefined}
            active={s.panel === "pending"}
            onSelect={() => s.setPanel(s.panel === "pending" ? "calendar" : "pending")}
            className={s.pendingCount.data?.failed ? "text-destructive" : undefined}
          />
          <SideNavItem label="Search" icon={Search} active={s.panel === "search"} onSelect={() => s.setPanel(s.panel === "search" ? "calendar" : "search")} />
          <SideNavItem label="Trash" icon={Trash2} active={s.panel === "trash"} onSelect={() => s.setPanel(s.panel === "trash" ? "calendar" : "trash")} />
          <SideNavItem label="People" icon={Users} to="/apps/contacts" />
        </SideNavGroup>
        <CalendarList
          calendars={s.calendars.data ?? []}
          accounts={s.meta.data?.accounts ?? []}
          onToggle={(id, hidden) => s.toggleCalendar.mutate({ id, hidden })}
        />
        <SideNavFooter>
          {(s.meta.data?.accounts ?? []).some((a) => a.calendarState === "reauth_required") ? (
            <Link to="/apps/settings/accounts" className="text-destructive flex items-center gap-1.5 px-2 py-1 text-xs">
              <AlertTriangle size={12} /> An account needs reconnecting
            </Link>
          ) : null}
          <SideNavItem label="Calendar settings" icon={Settings} to="/apps/settings/calendar" />
        </SideNavFooter>
      </SideNav>

      <section className="flex min-h-0 min-w-0 flex-col">
        {s.panel === "calendar" ? (
          <>
            <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
              <Button variant="outline" size="sm" onClick={s.goToday}>
                Today
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Previous" onClick={s.prev}>
                <ChevronLeft />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Next" onClick={s.next}>
                <ChevronRight />
              </Button>
              <h2 className="text-lg font-semibold">{title}</h2>
              {s.occurrences.isFetching ? <Loader2 size={14} className="text-muted-foreground animate-spin" /> : null}
              <Select value={s.view} onValueChange={(v) => s.setView(v as CalendarView)}>
                <SelectTrigger size="sm" className="ml-auto w-32" aria-label="View">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIEWS.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label} <span className="text-muted-foreground ml-2 text-xs">{v.key}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </header>
            {!s.calendars.data?.length ? (
              <div className="text-muted-foreground m-auto text-sm">No calendars yet.</div>
            ) : s.view === "month" ? (
              <MonthView
                start={s.range.start}
                cursor={s.cursor}
                today={s.today}
                tz={s.tz}
                items={s.items}
                calendars={calendarsById}
                showWeekNumbers={!!settings?.showWeekNumbers}
                hideWeekends={hideWeekends}
                selectedKey={s.selected?.key ?? null}
                onSelect={s.setSelected}
                onCreateDay={(day) => openCreate({ isAllDay: true, startDate: day, endDate: addDays(day, 1) })}
                onOpenDay={(day) => {
                  s.setCursor(day);
                  s.setView("day");
                }}
              />
            ) : s.view === "agenda" ? (
              <AgendaView
                start={s.range.start}
                end={s.range.end}
                today={s.today}
                tz={s.tz}
                items={s.items}
                calendars={calendarsById}
                selectedKey={s.selected?.key ?? null}
                onSelect={s.setSelected}
              />
            ) : s.view === "year" ? (
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-6 overflow-y-auto p-6 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 12 }, (_, m) => `${s.cursor.slice(0, 4)}-${String(m + 1).padStart(2, "0")}-01`).map((month) => (
                  <MiniMonth
                    key={month}
                    compact
                    month={month}
                    today={s.today}
                    weekStart={s.weekStart}
                    busyDays={busyDays}
                    onPick={(day) => {
                      s.setCursor(day);
                      s.setView("day");
                    }}
                  />
                ))}
              </div>
            ) : (
              <TimeGrid
                days={days}
                items={s.items}
                tz={s.tz}
                today={s.today}
                settings={settings}
                calendars={calendarsById}
                selectedKey={s.selected?.key ?? null}
                canEdit={canEdit}
                onSelect={s.setSelected}
                onCreate={openCreate}
                onMove={onMove}
                onDayClick={(day) => {
                  s.setCursor(day);
                  s.setView("day");
                }}
              />
            )}
          </>
        ) : s.panel === "pending" ? (
          <PendingPush
            tz={s.tz}
            onOpenEvent={(row) => {
              s.setPanel("calendar");
              s.setCursor(row.startDate ?? (row.startAt ? toWall(row.startAt, s.tz).date : s.cursor));
              s.setSelected(occurrenceFromPending(row));
            }}
          />
        ) : s.panel === "trash" ? (
          <TrashPanel tz={s.tz} calendars={calendarsById} />
        ) : (
          <section className="flex min-h-0 flex-1 flex-col gap-3 p-5">
            <div className="relative">
              <Search size={14} className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
              <Input autoFocus value={s.query} onChange={(e) => s.setQuery(e.target.value)} placeholder="Search events, people, places" className="pl-8" />
              {s.query ? (
                <button
                  type="button"
                  aria-label="Clear"
                  className="text-muted-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
                  onClick={() => s.setQuery("")}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
            {s.search.isFetching ? <Loader2 className="text-muted-foreground animate-spin" size={16} /> : null}
            <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
              {(s.search.data ?? []).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="hover:bg-accent/50 flex items-center gap-3 rounded-md px-2 py-2 text-left text-sm"
                  onClick={() => {
                    s.setPanel("calendar");
                    s.setCursor(r.startDate ?? (r.startAt ? toWall(r.startAt, s.tz).date : s.cursor));
                    s.setSelected(occurrenceFromPending({ ...r, eventId: r.id, occurrenceStart: null } as unknown as PendingChange));
                  }}
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: calendarsById.get(r.calendarId)?.color }} />
                  <span className="min-w-0 flex-1 truncate font-medium">{r.title || "(no title)"}</span>
                  <span className="text-muted-foreground text-xs">{formatRange(r, s.tz)}</span>
                </button>
              ))}
              {s.query.trim().length > 1 && !s.search.isFetching && !s.search.data?.length ? (
                <p className="text-muted-foreground text-sm">No matching events.</p>
              ) : null}
            </div>
          </section>
        )}
      </section>

      {showDetails && s.selected ? (
        <EventDetails
          key={s.selected.key}
          occurrence={s.selected}
          tz={s.tz}
          onClose={() => s.setSelected(null)}
          onEdit={() => s.openEditor({ eventId: s.selected!.eventId, occurrence: s.selected })}
          onDelete={() => {
            const o = s.selected!;
            s.withScope(o, "Delete", (scope) => s.removeEvent.mutate({ occurrence: o, scope }));
          }}
          onChanged={s.invalidateEvents}
          onOpenPending={() => s.setPanel("pending")}
          withScope={s.withScope}
        />
      ) : null}

      {s.editor ? (
        <EventEditor
          state={s.editor}
          tz={s.tz}
          settings={settings}
          calendars={s.calendars.data ?? []}
          defaultCalendarId={s.defaultCalendarId}
          onClose={s.closeEditor}
          onSaved={(provider) => {
            s.closeEditor();
            s.invalidateEvents();
            if (provider) s.flash("Saved — waiting in Pending push for approval");
          }}
          askScope={(o, run) => s.withScope(o, "Edit", run)}
        />
      ) : null}

      <ScopeDialog request={s.scopeRequest} onClose={() => s.setScopeRequest(null)} />
      <ReminderToasts
        reminders={s.reminders}
        onDone={s.dismissReminder}
        onOpen={(r) => {
          s.setCursor(toWall(r.occurrenceStart, s.tz).date);
          s.dismissReminder(r.deliveryId);
        }}
      />
      {s.toast ? (
        <div
          role="status"
          className="bg-foreground text-background absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 text-sm shadow-xl"
        >
          {s.toast}
          {s.toast.includes("Pending push") ? (
            <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => s.setPanel("pending")}>
              Review
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
