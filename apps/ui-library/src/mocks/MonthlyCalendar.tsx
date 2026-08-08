import { useMemo, useState } from "react";
import {
  Button,
  DatePicker,
  Dialog,
  IconButton,
  Input,
  MonthCalendar,
  SearchInput,
  Select,
  Tabs,
  TimePicker,
  type CalTone,
  type MonthEvent,
} from "@twodb/ui";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

interface MockEvent extends MonthEvent {
  cal: "team" | "shared" | "public";
}

function ev(
  id: string,
  day: number,
  title: string,
  time: string,
  tone: CalTone,
  cal: MockEvent["cal"] = "team",
): MockEvent {
  return { id, date: `2026-01-${String(day).padStart(2, "0")}`, title, time, tone, cal };
}

const EVENTS: MockEvent[] = [
  // week 1
  ev("standup-5", 5, "Monday standup", "9:00 AM", "neutral"),
  ev("coffee-5", 5, "Coffee with Alina", "11:30 AM", "warning"),
  ev("marketing-5", 5, "Marketing site review", "2:30 PM", "cobalt"),
  ev("1on1-8", 8, "One-on-one w/ Priya", "10:00 AM", "rose", "shared"),
  ev("allhands-8", 8, "All-hands meeting", "4:00 PM", "danger", "public"),
  ev("dinner-8", 8, "Dinner with C…", "6:30 PM", "warning"),
  ev("fri-9", 9, "Friday standup", "9:00 AM", "cobalt"),
  ev("house-9", 9, "House inspection", "10:30 AM", "warning"),
  // week 2
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
  // week 3
  ev("standup-19", 19, "Monday standup", "9:00 AM", "neutral"),
  ev("lunch-19", 19, "Team lunch", "12:15 PM", "rose"),
  ev("planning-21", 21, "Product planning", "9:30 AM", "cobalt"),
  ev("amelie-22", 22, "Amélie's first day", "10:00 AM", "rose"),
  ev("allhands-22", 22, "All-hands meeting", "4:00 PM", "danger", "public"),
  ev("fri-23", 23, "Friday standup", "9:00 AM", "cobalt"),
  ev("coffee-23", 23, "Coffee w/ Amélie", "9:30 AM", "warning"),
  ev("feedback-23", 23, "Design feedback", "2:30 PM", "cobalt", "shared"),
  ev("marathon-24", 24, "Half marathon", "7:00 AM", "warning", "public"),
  // week 4
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

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const SHORT_MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });

export function MonthlyCalendarMock() {
  const [month, setMonth] = useState(new Date(2026, 0, 1));
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("month");
  const [events, setEvents] = useState<MockEvent[]>(EVENTS);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newTime, setNewTime] = useState<Date | undefined>();
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

  function shiftMonth(dir: number) {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + dir, 1));
  }

  function openAdd(day?: Date) {
    setNewDate(day ?? new Date(2026, 0, 10));
    setNewTime(undefined);
    setNewTitle("");
    setAddOpen(true);
  }

  function addEvent() {
    if (!newTitle.trim() || !newDate) return;
    const time = newTime
      ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(newTime)
      : undefined;
    const iso = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}-${String(newDate.getDate()).padStart(2, "0")}`;
    setEvents((cur) => [
      ...cur,
      { id: `new-${Date.now()}`, date: iso, title: newTitle.trim(), time, tone: newTone, cal: "team" },
    ]);
    setAddOpen(false);
  }

  const monthEvents = visible.filter(
    (e) => Number(e.date.slice(5, 7)) === month.getMonth() + 1 && Number(e.date.slice(0, 4)) === month.getFullYear(),
  );

  const listDays = useMemo(() => {
    const map = new Map<string, MockEvent[]>();
    for (const e of monthEvents) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [monthEvents]);

  return (
    <div className="mock-cal">
      <header className="mock-cal__head">
        <h2>Calendar</h2>
        <div className="mock-cal__search">
          <SearchInput
            placeholder="Search events…"
            aria-label="Search events"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </header>

      <Tabs
        aria-label="Calendars"
        value={tab}
        onValueChange={setTab}
        items={[
          { id: "all", label: "All events" },
          { id: "shared", label: "Shared" },
          { id: "public", label: "Public" },
          { id: "archived", label: "Archived" },
        ]}
      />

      {tab === "archived" ? (
        <div className="mock-cal__empty">
          <p>Nothing archived. Events you archive will rest here.</p>
        </div>
      ) : (
        <div className="mock-cal__card">
          <div className="mock-cal__toolbar">
            <div className="mock-cal__monthchip">
              <span className="mock-cal__monthchip-mon">{SHORT_MONTH.format(month)}</span>
              <b className="tw-tnum">10</b>
            </div>
            <div className="mock-cal__monthlabel">
              <strong>{MONTH_LABEL.format(month)}</strong>
              <span className="tw-tnum">
                {MONTH_LABEL.format(month).split(" ")[0]} 1 –{" "}
                {new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()},{" "}
                {month.getFullYear()}
              </span>
            </div>
            <div className="mock-cal__tools">
              <IconButton label="Previous month" icon={<ChevronLeft />} variant="secondary" onClick={() => shiftMonth(-1)} />
              <Button size="sm" variant="secondary" onClick={() => setMonth(new Date())}>
                Today
              </Button>
              <IconButton label="Next month" icon={<ChevronRight />} variant="secondary" onClick={() => shiftMonth(1)} />
              <div style={{ width: 130 }}>
                <Select
                  aria-label="View"
                  value={view}
                  onValueChange={setView}
                  options={[
                    { value: "month", label: "Month view" },
                    { value: "list", label: "List view" },
                  ]}
                />
              </div>
              <Button size="sm" onClick={() => openAdd()}>
                <Plus size={14} aria-hidden="true" />
                Add event
              </Button>
            </div>
          </div>

          {view === "month" ? (
            <MonthCalendar
              month={month}
              events={visible}
              today={new Date(2026, 0, 10)}
              onSelectDay={(d) => openAdd(d)}
            />
          ) : (
            <div className="mock-cal__list">
              {listDays.length === 0 ? (
                <p className="mock-cal__empty">No events this month.</p>
              ) : (
                listDays.map(([date, evs]) => (
                  <div key={date} className="mock-cal__listday">
                    <span className="mock-cal__listdate tw-tnum">
                      {new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(
                        new Date(date + "T12:00:00"),
                      )}
                    </span>
                    <div className="mock-cal__listevents">
                      {evs.map((e) => (
                        <span key={e.id} className={`tw-mcal__ev tw-mcal__ev--${e.tone ?? "cobalt"}`}>
                          <span className="tw-mcal__ev-title">{e.title}</span>
                          {e.time ? <span className="tw-mcal__ev-time tw-tnum">{e.time}</span> : null}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add event"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addEvent} disabled={!newTitle.trim() || !newDate}>
              Add event
            </Button>
          </>
        }
      >
        <div className="mock-cal__form">
          <Input
            label="Title"
            placeholder="Dentist appointment"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <DatePicker label="Date" value={newDate} onValueChange={setNewDate} />
          <TimePicker label="Time" value={newTime} onValueChange={setNewTime} placeholder="No time set" />
          <Select
            label="Color"
            value={newTone}
            onValueChange={(v) => setNewTone(v as CalTone)}
            options={[
              { value: "cobalt", label: "Cobalt" },
              { value: "rose", label: "Rose" },
              { value: "warning", label: "Amber" },
              { value: "neutral", label: "Neutral" },
              { value: "danger", label: "Urgent" },
            ]}
          />
        </div>
      </Dialog>
    </div>
  );
}
