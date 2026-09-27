import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CalEvent } from "./use-calendar-scene";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const TONE_CHIP: Record<string, string> = {
  cobalt: "bg-blue-500/15 text-blue-400",
  rose: "bg-rose-400/15 text-rose-300",
  warning: "bg-amber-500/15 text-amber-500",
  danger: "bg-red-500/15 text-red-400",
  neutral: "bg-muted text-muted-foreground",
};

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 42 cells (6 weeks) starting on Monday. */
export function monthDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const dow = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - dow);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function MonthCalendar({ month, events, today, onSelectDay }: { month: Date; events: CalEvent[]; today?: Date; onSelectDay?: (date: Date) => void }) {
  const todayIso = iso(today ?? new Date());
  const monthIndex = month.getMonth();

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  const days = useMemo(() => monthDays(month), [month]);

  return (
    <div className="grid grid-cols-7">
      {WEEKDAYS.map((d) => (
        <span key={d} className="text-muted-foreground/70 border-b px-2 py-2 text-[11px] font-semibold tracking-wider uppercase">
          {d}
        </span>
      ))}
      {days.map((day, i) => {
        const key = iso(day);
        const dayEvents = byDay.get(key) ?? [];
        const visibleEvents = dayEvents.slice(0, 3);
        const extra = dayEvents.length - visibleEvents.length;
        const outside = day.getMonth() !== monthIndex;
        const isToday = key === todayIso;
        return (
          <div
            key={key}
            className={cn(
              "flex min-h-24 flex-col gap-0.5 border-b border-l p-1.5 first:border-l-0",
              i % 7 === 0 && "border-l-0",
              outside && "text-muted-foreground/40 bg-muted/10",
              onSelectDay && "hover:bg-accent/40 cursor-pointer transition-colors",
            )}
            onClick={() => onSelectDay?.(day)}
          >
            <span className="text-xs tabular-nums">
              {isToday ? (
                <b className="bg-primary text-primary-foreground grid size-5 place-items-center rounded-full font-semibold">{day.getDate()}</b>
              ) : (
                day.getDate()
              )}
            </span>
            {visibleEvents.map((e) => (
              <span
                key={e.id}
                className={cn(
                  "flex w-full items-baseline gap-1 overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] font-medium whitespace-nowrap",
                  TONE_CHIP[e.tone],
                )}
              >
                <span className="truncate">{e.title}</span>
                {e.time ? <span className="ml-auto shrink-0 text-[10px] opacity-75 tabular-nums">{e.time}</span> : null}
              </span>
            ))}
            {extra > 0 ? <span className="text-muted-foreground px-1 text-[10px]">+{extra} more…</span> : null}
          </div>
        );
      })}
    </div>
  );
}

/** Compact picker used in the day view side panel. */
export function MiniCalendar({ month, selected, onSelectDay }: { month: Date; selected: Date; onSelectDay?: (date: Date) => void }) {
  const days = useMemo(() => monthDays(month), [month]);
  const selectedIso = iso(selected);

  return (
    <div className="grid grid-cols-7 gap-0.5">
      {WEEKDAYS.map((d) => (
        <span key={d} className="text-muted-foreground/70 pb-1 text-center text-[10px] font-semibold uppercase">
          {d[0]}
        </span>
      ))}
      {days.map((day) => {
        const key = iso(day);
        const isSelected = key === selectedIso;
        const outside = day.getMonth() !== month.getMonth();
        return (
          <button
            key={key}
            type="button"
            className={cn(
              "grid aspect-square place-items-center rounded-md text-xs tabular-nums transition-colors",
              outside && "text-muted-foreground/35",
              !isSelected && !outside && "hover:bg-accent/60 text-foreground",
              isSelected && "bg-primary text-primary-foreground font-semibold",
            )}
            onClick={() => onSelectDay?.(day)}
          >
            {day.getDate()}
          </button>
        );
      })}
    </div>
  );
}
