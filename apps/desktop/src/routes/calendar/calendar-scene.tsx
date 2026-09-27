import { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock,
  FolderOpen,
  Plus,
  Settings,
  Star,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { CalTone, DailyCategory, DailyEvent } from "./use-calendar-scene";
import {
  DAILY_DAYS,
  DAILY_END_HOUR,
  DAILY_HOUR_HEIGHT,
  DAILY_NOW_HOUR,
  DAILY_START_HOUR,
  WEEK_HOUR_HEIGHT,
  WEEK_START_HOUR,
  formatHour,
  weekStartFor,
} from "./use-calendar-scene";
import { MiniCalendar, MonthCalendar, TONE_CHIP } from "./month-calendar";
import { useCalendarScene, WEEK_EVENTS } from "./use-calendar-scene";

const TONE_EVENT: Record<CalTone, string> = {
  cobalt: "bg-blue-500/10 border-blue-500/40",
  rose: "bg-rose-400/10 border-rose-400/40",
  warning: "bg-amber-500/10 border-amber-500/40",
  danger: "bg-red-500/10 border-red-500/40",
  neutral: "bg-muted/60 border-muted-foreground/30",
};

const TONE_SELECT: { value: CalTone; label: string }[] = [
  { value: "cobalt", label: "Cobalt" },
  { value: "rose", label: "Rose" },
  { value: "warning", label: "Amber" },
  { value: "neutral", label: "Neutral" },
  { value: "danger", label: "Urgent" },
];

const WEEKDAY_LABEL = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const SHORT_MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

function WeekView({ anchor }: { anchor: Date }) {
  const weekStart = weekStartFor(anchor);
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));

  return (
    <ScrollArea>
      <div className="min-w-200">
        <div className="grid grid-cols-[64px_repeat(7,minmax(26px,1fr))] border-b">
          <span className="text-muted-foreground p-2.5 text-[10px]">UTC +5:30</span>
          {days.map((day) => {
            const isToday = day.getDate() === 10;
            return (
              <div key={day.toISOString()} className={cn("flex min-w-0 flex-col gap-px border-l p-2.5", isToday && "bg-primary/10")}>
                <strong className={cn("text-base font-semibold", isToday ? "text-primary" : "text-muted-foreground")}>{day.getDate()}</strong>
                <span className="text-muted-foreground text-xs">{WEEKDAY_LABEL.format(day)}</span>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[64px_1fr]">
          <div className="flex flex-col">
            {[8, 10, 12, 14, 16, 18].map((hour) => (
              <span key={hour} className="text-muted-foreground block h-36 border-b px-2 pt-1.5 text-[10px]">
                {formatHour(hour)}
              </span>
            ))}
          </div>
          <div className="relative grid h-216 grid-cols-7">
            {days.map((day, dayIndex) => (
              <div
                key={day.toISOString()}
                className="relative h-216 border-l"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to bottom, transparent 0, transparent 143px, var(--color-border) 143px, var(--color-border) 144px)",
                }}
              >
                {WEEK_EVENTS.filter((event) => event.day === dayIndex).map((event) => (
                  <article
                    key={event.id}
                    className={cn(
                      "absolute inset-x-1.5 z-2 flex min-h-12 flex-col items-start gap-1 overflow-hidden rounded-md border border-l-2 p-2 px-2.5",
                      TONE_EVENT[event.tone],
                    )}
                    style={{ top: (event.start - WEEK_START_HOUR) * WEEK_HOUR_HEIGHT + 8, height: (event.end - event.start) * WEEK_HOUR_HEIGHT - 10 }}
                  >
                    <strong className="w-full truncate text-sm font-semibold">{event.title}</strong>
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px] whitespace-nowrap">
                      <Clock size={11} /> {formatHour(event.start)} – {formatHour(event.end)}
                    </span>
                    {event.people.length > 0 ? (
                      <span className="mt-auto flex items-center">
                        {event.people.slice(0, 3).map((person, i) => (
                          <Avatar key={person} size="sm" className={cn("text-[9px] ring-2 ring-background", i > 0 && "-ml-1.5")}>
                            <AvatarFallback>{initials(person)}</AvatarFallback>
                          </Avatar>
                        ))}
                      </span>
                    ) : null}
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

const DAILY_NAV = [
  { icon: CalendarDays, label: "Calendar", active: true },
  { icon: ClipboardList, label: "Tasks" },
  { icon: Users, label: "Patients" },
  { icon: FolderOpen, label: "Folders" },
  { icon: BarChart3, label: "Reports" },
];

const DAILY_CATEGORIES: { id: DailyCategory; label: string; chip: string; event: string }[] = [
  { id: "clinic", label: "Clinic", chip: "bg-emerald-500", event: "bg-primary/10 border-primary/60" },
  { id: "patients", label: "Patients", chip: "bg-rose-400", event: "bg-rose-400/10 border-rose-400/60" },
  { id: "admin", label: "Admin", chip: "bg-rose-400", event: "bg-rose-400/10 border-rose-400/60" },
  { id: "personal", label: "Personal", chip: "bg-amber-500", event: "bg-amber-500/10 border-amber-500/60" },
];

function DailyView() {
  const [dayIndex, setDayIndex] = useState(0);
  const [enabled, setEnabled] = useState<Record<DailyCategory, boolean>>({ clinic: true, patients: true, admin: true, personal: true });
  const [done, setDone] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    DAILY_DAYS.forEach((day, currentDayIndex) =>
      day.events.forEach((event, eventIndex) => {
        if (event.end <= DAILY_NOW_HOUR) initial.add(`${currentDayIndex}-${eventIndex}`);
      }),
    );
    return initial;
  });

  const day = DAILY_DAYS[dayIndex];
  const visible = useMemo(() => day.events.filter((event) => enabled[event.cat]), [day.events, enabled]);
  const categoryOf = (cat: DailyCategory) => DAILY_CATEGORIES.find((c) => c.id === cat)!;

  function toggleDone(id: string) {
    setDone((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_280px]">
      <aside className="bg-card flex flex-col gap-3 border-r p-4 px-3">
        <div className="flex flex-col items-center gap-1.5 border-b pb-3 text-center">
          <Avatar size="lg" className="size-14 text-lg">
            <AvatarFallback>AV</AvatarFallback>
          </Avatar>
          <strong className="text-base font-semibold">Asha Verma</strong>
          <Badge variant="destructive" className="text-[11px]">
            Clinic admin
          </Badge>
        </div>
        <nav aria-label="Daily calendar menu" className="flex flex-col gap-0.5">
          <span className="text-muted-foreground/70 pb-2 pl-2 text-[11px] font-semibold tracking-wider uppercase">Menu</span>
          {DAILY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <span
                key={item.label}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                  item.active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground",
                )}
              >
                <Icon size={15} className="shrink-0" />
                {item.label}
              </span>
            );
          })}
        </nav>
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground/70 pl-2 text-[11px] font-semibold tracking-wider uppercase">Categories</span>
          <div className="flex flex-wrap gap-2 pl-2">
            {DAILY_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                className={cn(
                  "rounded-sm px-3.5 py-1.5 text-[11px] font-semibold tracking-wider text-white uppercase transition-all hover:-translate-y-0.25",
                  category.chip,
                  !enabled[category.id] && "opacity-30",
                )}
                onClick={() => setEnabled((current) => ({ ...current, [category.id]: !current[category.id] }))}
                aria-pressed={enabled[category.id]}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-muted-foreground mt-auto flex items-center gap-2.5 px-2 py-1.5 text-sm">
          <Settings size={15} /> Settings
        </span>
      </aside>

      <main className="min-w-0 overflow-y-auto">
        <div className="grid grid-cols-[64px_minmax(0,1fr)] py-4 pr-4">
          <div className="flex flex-col">
            {Array.from({ length: DAILY_END_HOUR - DAILY_START_HOUR }, (_, i) => (
              <span key={i} className="text-muted-foreground block h-14 -translate-y-1.5 pr-2 text-right text-[11px] first:translate-y-0">
                {formatHour(DAILY_START_HOUR + i)}
              </span>
            ))}
          </div>
          <div className="relative h-168 border-t border-b">
            {Array.from({ length: DAILY_END_HOUR - DAILY_START_HOUR }, (_, i) => (
              <i key={i} className="block h-14 border-b" />
            ))}
            <span
              className="pointer-events-none absolute inset-y-0 -left-16 right-0 flex items-center"
              style={{ top: (DAILY_NOW_HOUR - DAILY_START_HOUR) * DAILY_HOUR_HEIGHT }}
            >
              <em className="w-14 -translate-y-1.5 pr-2 text-right text-[11px] font-semibold not-italic">{formatHour(DAILY_NOW_HOUR)}</em>
              <span className="h-0.5 flex-1 bg-foreground" />
            </span>
            {visible.map((event: DailyEvent) => {
              const cols = event.cols ?? 1;
              const col = event.col ?? 0;
              const id = `${dayIndex}-${day.events.indexOf(event)}`;
              return (
                <div
                  key={id}
                  className={cn(
                    "absolute flex min-h-9.5 flex-col gap-1 overflow-hidden rounded-md border border-l-2 p-2.5 px-3 transition-transform hover:-translate-y-0.25",
                    categoryOf(event.cat).event,
                  )}
                  style={{
                    top: (event.start - DAILY_START_HOUR) * DAILY_HOUR_HEIGHT + 3,
                    height: (event.end - event.start) * DAILY_HOUR_HEIGHT - 7,
                    left: `calc(${(col / cols) * 100}% + 4px)`,
                    width: `calc(${100 / cols}% - 10px)`,
                  }}
                >
                  <strong className="text-sm font-semibold">{event.title}</strong>
                  {event.note ? <span className="text-muted-foreground text-xs">{event.note}</span> : null}
                  <span className="text-muted-foreground/80 mt-auto text-[10px] font-medium tracking-wider uppercase">
                    {formatHour(event.start)} – {formatHour(event.end)} · Dr. Asha
                  </span>
                  {event.star ? <Star className="absolute top-2.5 right-2.5 size-3.5 fill-current text-amber-500" /> : null}
                  {done.has(id) ? (
                    <span className="absolute right-2.5 bottom-2 text-[10px] font-semibold tracking-wider text-emerald-500 uppercase">Done</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <aside className="bg-card flex flex-col gap-3 border-t border-l p-4 px-3 lg:col-span-2 xl:col-span-1 xl:border-t-0">
        <header className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous day"
            onClick={() => setDayIndex((index) => (index + DAILY_DAYS.length - 1) % DAILY_DAYS.length)}
          >
            <ChevronLeft size={15} />
          </Button>
          <h3 className="m-0 text-base font-semibold">
            {day.label} · <span className="text-muted-foreground font-normal">{day.date.getDate()} January</span>
          </h3>
          <Button variant="ghost" size="icon-sm" aria-label="Next day" onClick={() => setDayIndex((index) => (index + 1) % DAILY_DAYS.length)}>
            <ChevronRight size={15} />
          </Button>
        </header>
        <MiniCalendar
          month={day.date}
          selected={day.date}
          onSelectDay={(date) => {
            const nextIndex = DAILY_DAYS.findIndex((current) => current.date.toDateString() === date.toDateString());
            if (nextIndex >= 0) setDayIndex(nextIndex);
          }}
        />
        <div className="flex flex-col border-t pt-2">
          {day.events.map((event, eventIndex) => {
            const id = `${dayIndex}-${eventIndex}`;
            const isDone = done.has(id);
            const off = !enabled[event.cat];
            return (
              <button
                key={id}
                type="button"
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-1.5 py-2 text-left transition-colors",
                  isDone && "is-done",
                  off ? "pointer-events-none opacity-35" : "hover:bg-accent/50",
                )}
                onClick={() => toggleDone(id)}
                disabled={off}
              >
                <span className={cn("flex", isDone ? "text-emerald-500" : "text-muted-foreground")}>
                  {isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                </span>
                <span className="text-muted-foreground w-13 shrink-0 font-mono text-[10px]">{formatHour(event.start)}</span>
                <span className={cn("text-sm font-medium", isDone && "text-muted-foreground line-through")}>{event.title}</span>
              </button>
            );
          })}
        </div>
        <Button variant="secondary" size="sm" className="self-start">
          + Add event
        </Button>
      </aside>
    </div>
  );
}

export function CalendarScene() {
  const cal = useCalendarScene();
  const monthDaysCount = new Date(cal.month.getFullYear(), cal.month.getMonth() + 1, 0).getDate();

  return (
    <div className="bg-background flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4">
      <header className="flex items-center justify-between gap-4">
        <h2 className="m-0 text-xl font-semibold">Calendar</h2>
        <div className="relative w-65">
          <Input
            value={cal.query}
            onChange={(e) => cal.setQuery(e.target.value)}
            placeholder="Search events…"
            aria-label="Search events"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </header>

      <Tabs value={cal.tab} onValueChange={cal.setTab}>
        <TabsList>
          <TabsTrigger value="all">All events</TabsTrigger>
          <TabsTrigger value="shared">Shared</TabsTrigger>
          <TabsTrigger value="public">Public</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      {cal.tab === "archived" ? (
        <div className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          Nothing archived. Events you archive will rest here.
        </div>
      ) : (
        <div className="bg-card overflow-hidden rounded-xl border">
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            <div className="bg-muted/50 flex flex-col items-center rounded-md border px-2.5 py-1">
              <span className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">{SHORT_MONTH.format(cal.month)}</span>
              <b className="text-base leading-tight tabular-nums">10</b>
            </div>
            <div className="flex flex-col">
              <strong className="text-base font-semibold">{MONTH_LABEL.format(cal.month)}</strong>
              <span className="text-muted-foreground text-xs tabular-nums">
                {MONTH_LABEL.format(cal.month).split(" ")[0]} 1 – {monthDaysCount}, {cal.month.getFullYear()}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="icon-sm" aria-label="Previous period" onClick={() => cal.shiftPeriod(-1)}>
                <ChevronLeft size={15} />
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={() => cal.setMonth(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="icon-sm" aria-label="Next period" onClick={() => cal.shiftPeriod(1)}>
                <ChevronRight size={15} />
              </Button>
              <Select value={cal.view} onValueChange={(value) => cal.setView(value as typeof cal.view)}>
                <SelectTrigger className="h-8 w-32 text-xs" aria-label="View">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month view</SelectItem>
                  <SelectItem value="week">Week view</SelectItem>
                  <SelectItem value="day">Day view</SelectItem>
                  <SelectItem value="list">List view</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8" onClick={() => cal.openAdd()}>
                <Plus size={14} /> Add event
              </Button>
            </div>
          </div>

          {cal.view === "month" ? (
            <MonthCalendar month={cal.month} events={cal.visible} today={new Date(2026, 0, 10)} onSelectDay={(d) => cal.openAdd(d)} />
          ) : cal.view === "week" ? (
            <WeekView anchor={cal.month} />
          ) : cal.view === "day" ? (
            <DailyView />
          ) : cal.listDays.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">No events this month.</p>
          ) : (
            <div className="flex max-h-150 flex-col gap-3 overflow-y-auto p-4">
              {cal.listDays.map(([date, evs]) => (
                <div key={date} className="grid grid-cols-[110px_1fr] items-start gap-3">
                  <span className="pt-0.5 text-xs font-semibold">
                    {new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(date + "T12:00:00"))}
                  </span>
                  <div className="flex flex-col gap-1">
                    {evs.map((e) => (
                      <span
                        key={e.id}
                        className={cn(
                          "flex w-full items-baseline gap-1.5 overflow-hidden rounded px-1.5 py-0.5 text-left text-xs font-medium whitespace-nowrap",
                          TONE_CHIP[e.tone],
                        )}
                      >
                        <span className="truncate">{e.title}</span>
                        {e.time ? <span className="ml-auto shrink-0 text-[10px] opacity-75 tabular-nums">{e.time}</span> : null}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={cal.addOpen} onOpenChange={cal.setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add event</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cal-title">Title</Label>
              <Input id="cal-title" placeholder="Dentist appointment" value={cal.newTitle} onChange={(e) => cal.setNewTitle(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cal-date">Date</Label>
              <Input
                id="cal-date"
                type="date"
                value={
                  cal.newDate
                    ? `${cal.newDate.getFullYear()}-${String(cal.newDate.getMonth() + 1).padStart(2, "0")}-${String(cal.newDate.getDate()).padStart(2, "0")}`
                    : ""
                }
                onChange={(e) => cal.setNewDate(e.target.value ? new Date(e.target.value + "T12:00:00") : undefined)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cal-time">Time</Label>
              <Input id="cal-time" type="time" placeholder="No time set" value={cal.newTime} onChange={(e) => cal.setNewTime(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Color</Label>
              <Select value={cal.newTone} onValueChange={(value) => cal.setNewTone(value as CalTone)}>
                <SelectTrigger className="w-full" aria-label="Color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONE_SELECT.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => cal.setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={cal.addEvent} disabled={!cal.newTitle.trim() || !cal.newDate}>
              Add event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
