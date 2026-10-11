import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addDays, addMonths, formatDay, startOfMonth, startOfWeek } from "../calendar-api";

interface MiniMonthProps {
  month: string;
  today: string;
  weekStart: number;
  selected?: { start: string; end: string } | null;
  busyDays?: Set<string>;
  onPick: (day: string) => void;
  onMonth?: (month: string) => void;
  compact?: boolean;
}

/** Month grid used in the sidebar (with navigation) and the year view (static). */
export function MiniMonth({ month, today, weekStart, selected, busyDays, onPick, onMonth, compact }: MiniMonthProps) {
  const first = startOfMonth(month);
  const start = startOfWeek(first, weekStart);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const ym = first.slice(0, 7);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-semibold">{formatDay(first, { month: "long", year: compact ? undefined : "numeric" })}</span>
        {onMonth ? (
          <span className="flex">
            <Button variant="ghost" size="icon-xs" aria-label="Previous month" onClick={() => onMonth(addMonths(first, -1))}>
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="icon-xs" aria-label="Next month" onClick={() => onMonth(addMonths(first, 1))}>
              <ChevronRight />
            </Button>
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-7 text-center">
        {days.slice(0, 7).map((d) => (
          <span key={d} className="text-muted-foreground text-[10px] uppercase">
            {formatDay(d, { weekday: "narrow" })}
          </span>
        ))}
        {days.map((d) => {
          const inRange = selected && d >= selected.start && d < selected.end;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              className={cn(
                "relative mx-auto grid size-7 place-items-center rounded-full text-xs tabular-nums",
                d.slice(0, 7) !== ym && "text-muted-foreground/50",
                inRange && "bg-accent",
                d === today && "bg-primary text-primary-foreground font-semibold",
                "hover:ring-ring hover:ring-1",
              )}
            >
              {Number(d.slice(8))}
              {busyDays?.has(d) && d !== today ? <span className="bg-primary absolute bottom-0.5 size-1 rounded-full" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
