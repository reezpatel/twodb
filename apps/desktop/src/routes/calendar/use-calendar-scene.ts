import { useMemo, useState } from "react";

export type CalTone = "cobalt" | "rose" | "warning" | "danger" | "neutral";
export type CalendarView = "month" | "week" | "day" | "list";

export interface CalEvent {
  id: string;
  /** ISO date, yyyy-mm-dd */
  date: string;
  title: string;
  time?: string;
  tone: CalTone;
  cal: "team" | "shared" | "public";
}

export interface WeekEvent {
  id: string;
  title: string;
  day: number;
  start: number;
  end: number;
  tone: CalTone;
  people: string[];
}

export type DailyCategory = "clinic" | "patients" | "admin" | "personal";

export interface DailyEvent {
  title: string;
  note: string;
  start: number;
  end: number;
  cat: DailyCategory;
  star?: boolean;
  col?: number;
  cols?: number;
}

export interface DailyDay {
  label: string;
  date: Date;
  events: DailyEvent[];
}

function ev(id: string, day: number, title: string, time: string, tone: CalTone, cal: CalEvent["cal"] = "team"): CalEvent {
  return { id, date: `2026-01-${String(day).padStart(2, "0")}`, title, time, tone, cal };
}

const EVENTS: CalEvent[] = [
  ev("standup-5", 5, "Monday standup", "9:00 AM", "neutral"),
  ev("coffee-5", 5, "Coffee with Alina", "11:30 AM", "warning"),
  ev("marketing-5", 5, "Marketing site review", "2:30 PM", "cobalt"),
  ev("1on1-8", 8, "One-on-one w/ Priya", "10:00 AM", "rose", "shared"),
  ev("allhands-8", 8, "All-hands meeting", "4:00 PM", "danger", "public"),
  ev("dinner-8", 8, "Dinner with C…", "6:30 PM", "warning"),
  ev("fri-9", 9, "Friday standup", "9:00 AM", "cobalt"),
  ev("house-9", 9, "House inspection", "10:30 AM", "warning"),
  ev("standup-12", 12, "Monday standup", "9:00 AM", "neutral"),
  ev("content-12", 12, "Content planning", "11:00 AM", "rose"),
  ev("1on1-13", 13, "One-on-one w/ Sam", "10:00 AM", "rose", "shared"),
  ev("catchup-13", 13, "Catch up w/ Alex", "2:30 PM", "warning", "shared"),
  ev("deep-14", 14, "Deep work", "9:00 AM", "cobalt"),
  ev("sync-14", 14, "Design sync", "10:30 AM", "cobalt", "shared"),
  ev("seo-14", 14, "SEO planning", "1:30 PM", "cobalt"),
  ev("lunch-15", 15, "Lunch with C…", "12:00 PM", "warning"),
  ev("fri-16", 16, "Friday standup", "9:00 AM", "cobalt"),
  ev("olivia-16", 16, "Olivia × Riley", "10:00 AM", "rose"),
  ev("demo-16", 16, "Product demo", "1:30 PM", "cobalt", "public"),
  ev("house-17", 17, "House inspection", "11:00 AM", "warning"),
  ev("ava-18", 18, "Ava's engagement", "1:00 PM", "rose", "public"),
  ev("standup-19", 19, "Monday standup", "9:00 AM", "neutral"),
  ev("lunch-19", 19, "Team lunch", "12:15 PM", "rose"),
  ev("planning-21", 21, "Product planning", "9:30 AM", "cobalt"),
  ev("amelie-22", 22, "Amélie's first day", "10:00 AM", "rose"),
  ev("allhands-22", 22, "All-hands meeting", "4:00 PM", "danger", "public"),
  ev("fri-23", 23, "Friday standup", "9:00 AM", "cobalt"),
  ev("coffee-23", 23, "Coffee w/ Amélie", "9:30 AM", "warning"),
  ev("feedback-23", 23, "Design feedback", "2:30 PM", "cobalt", "shared"),
  ev("marathon-24", 24, "Half marathon", "7:00 AM", "warning", "public"),
  ev("standup-26", 26, "Monday standup", "9:00 AM", "neutral"),
  ev("deep-26", 26, "Deep work", "9:15 AM", "cobalt"),
  ev("quarterly-27", 27, "Quarterly review", "11:30 AM", "warning", "shared"),
  ev("lunch-27", 27, "Lunch with Zahir", "1:00 PM", "warning"),
  ev("dinner-27", 27, "Dinner with C…", "7:00 PM", "warning"),
  ev("deep-28", 28, "Deep work", "9:00 AM", "cobalt"),
  ev("sync-28", 28, "Design sync", "2:30 PM", "cobalt", "shared"),
  ev("amelie-29", 29, "Amélie coffee", "10:00 AM", "rose", "shared"),
  ev("fri-30", 30, "Friday standup", "9:00 AM", "cobalt"),
  ev("accountant-30", 30, "Accountant", "1:45 PM", "warning"),
  ev("marketing-30", 30, "Marketing site review", "2:30 PM", "cobalt"),
  ev("lunch-31", 31, "Lunch with Alina", "12:45 PM", "warning"),
];

export const WEEK_EVENTS: WeekEvent[] = [
  { id: "week-standup", title: "Monday standup", day: 0, start: 9, end: 10, tone: "neutral", people: ["Ava Thompson", "Ethan Carter", "Sophia Lee"] },
  { id: "week-coffee", title: "Coffee with Alina", day: 0, start: 11.5, end: 12.5, tone: "warning", people: ["Alina Ross"] },
  { id: "week-marketing", title: "Marketing site review", day: 0, start: 14.5, end: 15.5, tone: "cobalt", people: ["Maya Shah", "Noah Reed"] },
  { id: "week-priya", title: "One-on-one w/ Priya", day: 3, start: 10, end: 11, tone: "rose", people: ["Priya Nair"] },
  { id: "week-allhands", title: "All-hands meeting", day: 3, start: 16, end: 17, tone: "danger", people: ["Ava Thompson", "Ethan Carter", "Sophia Lee"] },
  { id: "week-dinner", title: "Dinner with C…", day: 3, start: 18.5, end: 19.5, tone: "warning", people: [] },
  { id: "week-friday", title: "Friday standup", day: 4, start: 9, end: 10, tone: "cobalt", people: ["Ava Thompson", "Liam Chen"] },
  { id: "week-house", title: "House inspection", day: 4, start: 10.5, end: 11.5, tone: "warning", people: [] },
];

export const DAILY_DAYS: DailyDay[] = [
  {
    label: "Monday",
    date: new Date(2026, 0, 12),
    events: [
      { title: "Ward 4 rounds", note: "Discharge check for Ravi Kumar", start: 8, end: 9, cat: "patients" },
      { title: "Morning standup", note: "Front desk + nursing", start: 9, end: 10, cat: "clinic" },
      { title: "Consultations", note: "Six appointments, one flagged panel", start: 10, end: 13, cat: "patients", star: true },
      { title: "Lunch", note: "", start: 13, end: 14, cat: "personal" },
      { title: "Invoice reminders", note: "Review wording before they send", start: 14, end: 15, cat: "admin" },
      { title: "Team meeting", note: "Weekly review prep", start: 15, end: 16, cat: "clinic" },
    ],
  },
  {
    label: "Tuesday",
    date: new Date(2026, 0, 13),
    events: [
      { title: "Morning standup", note: "", start: 9, end: 9.5, cat: "clinic" },
      { title: "Vaccination camp prep", note: "Cold-chain check with Meera", start: 10, end: 12, cat: "patients", star: true },
      { title: "Supplier call", note: "Gauze & gloves order", start: 12, end: 12.5, cat: "admin" },
      { title: "Check-up block", note: "Four follow-ups", start: 14, end: 16, cat: "patients", col: 0, cols: 2 },
      { title: "Call with the lab", note: "Overnight reports protocol", start: 15, end: 16, cat: "clinic", col: 1, cols: 2 },
      { title: "Weekly review", note: "KPIs + stock", start: 16, end: 18, cat: "clinic" },
    ],
  },
  {
    label: "Wednesday",
    date: new Date(2026, 0, 14),
    events: [
      { title: "Ward 4 rounds", note: "", start: 8, end: 9, cat: "patients" },
      { title: "Staff 1:1 — Dev", note: "Invoice workflow", start: 11, end: 12, cat: "clinic" },
      { title: "Consent paperwork", note: "Sana Sheikh intake", start: 13, end: 14, cat: "admin" },
      { title: "Evening consultations", note: "Walk-ins until close", start: 17, end: 19, cat: "patients", star: true },
    ],
  },
];

export const WEEK_START_HOUR = 8;
export const WEEK_HOUR_HEIGHT = 72;
export const DAILY_START_HOUR = 8;
export const DAILY_END_HOUR = 20;
export const DAILY_NOW_HOUR = 14;
export const DAILY_HOUR_HEIGHT = 56;

export function weekStartFor(date: Date) {
  const start = new Date(date);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

export function formatHour(hour: number) {
  const whole = Math.floor(hour);
  const minutes = hour % 1 ? "30" : "00";
  const suffix = whole < 12 ? "AM" : "PM";
  const hour12 = whole % 12 === 0 ? 12 : whole % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

const TIME_FORMAT = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/** Mock calendar state — month navigation, view switching, tab filter, search, add-event dialog. */
export function useCalendarScene() {
  const [month, setMonth] = useState(new Date(2026, 0, 1));
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<CalendarView>("month");
  const [events, setEvents] = useState<CalEvent[]>(EVENTS);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newTime, setNewTime] = useState("");
  const [newTone, setNewTone] = useState<CalTone>("cobalt");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (tab === "shared" && e.cal !== "shared") return false;
      if (tab === "public" && e.cal !== "public") return false;
      if (q && !e.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, tab, query]);

  const monthEvents = useMemo(
    () => visible.filter((e) => Number(e.date.slice(5, 7)) === month.getMonth() + 1 && Number(e.date.slice(0, 4)) === month.getFullYear()),
    [visible, month],
  );

  const listDays = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of monthEvents) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [monthEvents]);

  function shiftPeriod(dir: number) {
    setMonth((m) =>
      view === "month"
        ? new Date(m.getFullYear(), m.getMonth() + dir, 1)
        : new Date(m.getFullYear(), m.getMonth(), m.getDate() + dir * (view === "week" ? 7 : 1)),
    );
  }

  function openAdd(day?: Date) {
    setNewDate(day ?? new Date(2026, 0, 10));
    setNewTime("");
    setNewTitle("");
    setAddOpen(true);
  }

  function addEvent() {
    if (!newTitle.trim() || !newDate) return;
    const iso = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}-${String(newDate.getDate()).padStart(2, "0")}`;
    setEvents((cur) => [...cur, { id: `new-${Date.now()}`, date: iso, title: newTitle.trim(), time: newTime || undefined, tone: newTone, cal: "team" }]);
    setAddOpen(false);
  }

  return {
    month,
    setMonth,
    tab,
    setTab,
    query,
    setQuery,
    view,
    setView,
    weekEvents: WEEK_EVENTS,
    visible,
    listDays,
    shiftPeriod,
    openAdd,
    addOpen,
    setAddOpen,
    newTitle,
    setNewTitle,
    newDate,
    setNewDate,
    newTime,
    setNewTime,
    newTone,
    setNewTone,
    addEvent,
    timeFormat: TIME_FORMAT,
  };
}
