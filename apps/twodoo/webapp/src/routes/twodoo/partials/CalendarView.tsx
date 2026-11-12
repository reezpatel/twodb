import { useEffect, useMemo, useState } from "react";
import { cn } from "@twodb/blocks";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { twodooApi, type Task } from "../../../lib/twoodoo-client";
import { addDays, startOfDay, toDayKey } from "../../../lib/dates";
import { useTwoDoo } from "../hooks/useTwoDoo";

/** Calendar month view: time-bounded tasks laid onto a month grid, click a day to see its tasks in the list below. */
export function CalendarView() {
  const app = useTwoDoo();
  const [month, setMonth] = useState(() => new Date());
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>(() => toDayKey(new Date()));

  useEffect(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
    void twodooApi
      .listTasks({ from: first.toISOString(), to: last.toISOString(), status: "any" })
      .then(setAllTasks)
      .catch(() => setAllTasks([]));
  }, [month]);

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of allTasks) {
      if (!t.startAt) continue;
      const key = toDayKey(new Date(t.startAt));
      const list = m.get(key) ?? [];
      list.push(t);
      m.set(key, list);
    }
    return m;
  }, [allTasks]);

  // Monday-start grid; include leading/trailing days from adjacent months (muted)
  const grid = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = addDays(startOfDay(first), -((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const todayKey = toDayKey(new Date());
  const monthLabel = month.toLocaleDateString([], { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-5xl px-6 py-5">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="px-1 text-base font-semibold">{monthLabel}</h1>
        <div className="flex items-center gap-1">
          <button className="rounded-md border border-outline bg-paper p-1.5 hover:border-ion/40" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <ChevronLeft size={13} />
          </button>
          <button className="rounded-md border border-outline bg-paper px-2 py-1 text-xs hover:border-ion/40" onClick={() => setMonth(new Date())}>
            Today
          </button>
          <button className="rounded-md border border-outline bg-paper p-1.5 hover:border-ion/40" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <ChevronRight size={13} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-outline bg-outline">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="bg-paper/80 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-ink/70">
            {d}
          </div>
        ))}
        {grid.map((day) => {
          const key = toDayKey(day);
          const tasks = byDay.get(key) ?? [];
          const other = day.getMonth() !== month.getMonth();
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;
          return (
            <button
              key={key}
              className={cn("min-h-20 bg-paper p-1.5 text-left align-top transition-colors hover:bg-ion/[0.04]", other && "bg-paper/40", isSelected && "bg-ion/10")}
              onClick={() => setSelectedDay(key)}
            >
              <div className={cn("mb-1 inline-grid size-5 place-items-center rounded-full text-[11px]", isToday && "bg-ion font-semibold text-paper")}>
                {day.getDate()}
              </div>
              <div className="flex flex-col gap-0.5">
                {tasks.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "truncate rounded px-1 py-px text-[10px]",
                      t.status === "done" ? "text-muted-ink line-through opacity-60" : "bg-ink/[0.06]",
                      t.priority === "urgent" && "bg-rose-500/15 text-rose-600",
                      t.priority === "high" && "bg-amber-500/15 text-amber-700",
                    )}
                  >
                    {!t.allDay && t.startAt && new Date(t.startAt).getHours() > 0
                      ? `${new Date(t.startAt).toLocaleTimeString([], { hour: "numeric" })} `
                        : ""}
                    {t.title}
                  </div>
                ))}
                {tasks.length > 3 && <div className="px-1 text-[10px] text-muted-ink">+{tasks.length - 3} more</div>}
              </div>
            </button>
          );
        })}
      </div>

      <section className="mt-4">
        <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-ink/60">
          {new Date(`${selectedDay}T12:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </h2>
        <div className="flex flex-col rounded-xl border border-outline bg-paper p-1">
          {(byDay.get(selectedDay) ?? []).length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-ink/60">Nothing scheduled</div>
          )}
          {(byDay.get(selectedDay) ?? []).map((t) => (
            <button
              key={t.id}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-ink/[0.04]"
              onClick={() => {
                app.setView({ kind: "list", listId: t.listId });
                app.setActiveTaskId(t.id);
              }}
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", t.status === "done" ? "bg-emerald-500" : t.priority === "urgent" ? "bg-rose-500" : t.priority === "high" ? "bg-amber-500" : "bg-muted-ink/40")} />
              <span className={cn("min-w-0 flex-1 truncate text-sm", t.status === "done" && "text-muted-ink line-through")}>{t.title}</span>
              {!t.allDay && t.startAt && <span className="font-mono text-[11px] text-muted-ink">{new Date(t.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
