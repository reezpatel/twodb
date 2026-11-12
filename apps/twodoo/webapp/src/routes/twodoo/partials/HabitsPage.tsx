import { useMemo, useState } from "react";
import { cn } from "@twodb/blocks";
import { Check, Flame, Minus, Plus, Trash2, Zap } from "lucide-react";
import { useTwoDoo } from "../hooks/useTwoDoo";
import { addDays, startOfDay, toDayKey } from "../../../lib/dates";
import type { Habit } from "../../../lib/twoodoo-client";

/** Habits tab: check-in cards with streaks + goal progress + 91-day mini heatmaps. */
export function HabitsPage() {
  const app = useTwoDoo();
  const [newHabit, setNewHabit] = useState("");

  const today = toDayKey(new Date());
  const metToday = (h: Habit) => {
    const total = h.logs.filter((l) => l.date === today).reduce((n, l) => n + l.count, 0);
    return total >= h.targetCount;
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-5">
      <header className="mb-4 flex items-baseline justify-between px-1">
        <h1 className="text-base font-semibold">Habits</h1>
        <span className="text-xs text-muted-ink">{app.habits.length} tracked</span>
      </header>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-outline bg-paper px-3 py-2">
        <Plus size={14} className="text-muted-ink" />
        <input
          value={newHabit}
          placeholder="New habit — e.g. Read 20 pages"
          onChange={(e) => setNewHabit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newHabit.trim()) {
              void app.createHabit(newHabit.trim());
              setNewHabit("");
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-ink/60"
        />
      </div>

      {app.habits.length === 0 && !app.loading && (
        <div className="rounded-xl border border-dashed border-outline px-4 py-10 text-center text-xs text-muted-ink/70">
          No habits yet — add one above
        </div>
      )}

      <div className="flex flex-col gap-3">
        {app.habits.map((habit) => (
          <HabitCard key={habit.id} habit={habit} metToday={metToday(habit)} />
        ))}
      </div>
    </div>
  );
}

function HabitCard(props: { habit: Habit; metToday: boolean }) {
  const app = useTwoDoo();
  const { habit } = props;
  const today = toDayKey(new Date());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const goalPct = habit.goalStreak ? Math.min(100, Math.round((habit.streak / habit.goalStreak) * 100)) : null;
  const scheduledToday = habit.schedule !== "weekly" || !habit.byWeekday?.length || habit.byWeekday.includes(new Date().getDay());

  return (
    <div className="rounded-xl border border-outline bg-paper p-4">
      <div className="flex items-start gap-3">
        <button
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg border transition-colors",
            props.metToday ? "border-emerald-500 bg-emerald-500 text-white" : "border-outline text-muted-ink hover:border-emerald-400 hover:text-emerald-500",
            !scheduledToday && "opacity-40",
          )}
          onClick={() => void app.checkInHabit(habit.id, today, props.metToday ? -1 : 1)}
          title={props.metToday ? "Undo today's check-in" : scheduledToday ? "Check in" : "Not scheduled today (still allowed)"}
        >
          {props.metToday ? <Check size={16} strokeWidth={3} /> : <Plus size={16} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{habit.name}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-rose-500">
              <Flame size={10} />
              {habit.streak}d
            </span>
            {habit.goalStreak && (
              <span className="text-[11px] text-muted-ink" title={`Goal: ${habit.goalStreak} day streak`}>
                goal {habit.goalStreak}d · {goalPct}%
              </span>
            )}
            <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-ink/70">
              <Zap size={10} /> best {habit.bestStreak}d
            </span>
            {confirmDelete ? (
              <span className="flex items-center gap-1 text-[11px]">
                <button className="rounded px-1.5 py-0.5 text-rose-500 hover:bg-rose-500/10" onClick={() => void app.deleteHabit(habit.id)}>
                  delete
                </button>
                <button className="text-muted-ink hover:text-ink" onClick={() => setConfirmDelete(false)}>
                  no
                </button>
              </span>
            ) : (
              <button className="text-muted-ink/40 hover:text-rose-400" onClick={() => setConfirmDelete(true)} title="Delete habit">
                <Trash2 size={11} />
              </button>
            )}
          </div>

          {habit.goalStreak != null && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${goalPct ?? 0}%` }} />
            </div>
          )}

          <HeatMap habit={habit} />
        </div>
      </div>
    </div>
  );
}

/** Last 13 weeks (91 days) heatmap, GitHub-style columns of 7 days. */
function HeatMap(props: { habit: Habit }) {
  const app = useTwoDoo();
  const days = useMemo(() => {
    const today = startOfDay(new Date());
    const end = addDays(today, 6 - today.getDay()); // pad to Saturday
    const out: Date[] = [];
    for (let i = 90; i >= 0; i--) out.push(addDays(end, -i));
    return out;
  }, []);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of props.habit.logs) m.set(l.date, (m.get(l.date) ?? 0) + l.count);
    return m;
  }, [props.habit.logs]);

  const level = (d: Date): 0 | 1 | 2 | 3 => {
    const c = counts.get(toDayKey(d)) ?? 0;
    if (c === 0) return 0;
    if (c >= props.habit.targetCount) return 3;
    if (c === 1 && props.habit.targetCount > 1) return 1;
    return 2;
  };
  const future = (d: Date) => d.getTime() > Date.now();

  // group into weeks of 7
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="mt-2.5 flex gap-[3px] overflow-x-auto pb-0.5">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {week.map((d) => {
            const lvl = level(d);
            const isToday = toDayKey(d) === toDayKey(new Date());
            return (
              <button
                key={d.toISOString()}
                className={cn(
                  "size-2.5 rounded-[2px]",
                  lvl === 0 && "bg-ink/[0.07]",
                  lvl === 1 && "bg-emerald-500/30",
                  lvl === 2 && "bg-emerald-500/60",
                  lvl === 3 && "bg-emerald-500",
                  future(d) && "opacity-25",
                  isToday && "ring-1 ring-ion ring-offset-0",
                )}
                title={`${toDayKey(d)} — ${counts.get(toDayKey(d)) ?? 0} check-in${(counts.get(toDayKey(d)) ?? 0) === 1 ? "" : "s"}`}
                onClick={() => {
                  if (future(d)) return;
                  const c = counts.get(toDayKey(d)) ?? 0;
                  void app.checkInHabit(props.habit.id, toDayKey(d), c > 0 ? -1 : 1);
                }}
              />
            );
          })}
        </div>
      ))}
      <div className="ml-1 flex items-center text-[10px] text-muted-ink/60">
        <Minus size={9} className="opacity-0" />
        {props.habit.totalCheckIns} total
      </div>
    </div>
  );
}
