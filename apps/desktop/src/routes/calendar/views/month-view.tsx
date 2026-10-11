import { cn } from "@/lib/utils";
import { addDays, formatDay, formatTime, isoWeek, type CalendarItem, type Occurrence } from "../calendar-api";
import { ChipIcons, chipStyle, declinedClass } from "./event-chip";
import { eventColor, isSpanning, itemsOnDay } from "./layout";

const MAX_PER_CELL = 4;

interface MonthViewProps {
  start: string;
  cursor: string;
  today: string;
  tz: string;
  items: Occurrence[];
  calendars: Map<string, CalendarItem>;
  showWeekNumbers: boolean;
  hideWeekends: boolean;
  selectedKey: string | null;
  onSelect: (o: Occurrence) => void;
  onCreateDay: (day: string) => void;
  onOpenDay: (day: string) => void;
}

export function MonthView({
  start,
  cursor,
  today,
  tz,
  items,
  calendars,
  showWeekNumbers,
  hideWeekends,
  selectedKey,
  onSelect,
  onCreateDay,
  onOpenDay,
}: MonthViewProps) {
  const weeks = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)).filter((day) => !hideWeekends || ![0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay())),
  );
  const month = cursor.slice(0, 7);
  const cols = { gridTemplateColumns: `${showWeekNumbers ? "28px " : ""}repeat(${weeks[0].length}, minmax(0, 1fr))` };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid border-b" style={cols}>
        {showWeekNumbers ? <span /> : null}
        {weeks[0].map((day) => (
          <span key={day} className="text-muted-foreground px-2 py-1.5 text-xs uppercase">
            {formatDay(day, { weekday: "short" })}
          </span>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-6">
        {weeks.map((week) => (
          <div key={week[0]} className="grid min-h-0 border-b" style={cols}>
            {showWeekNumbers ? <span className="text-muted-foreground/70 px-1 pt-1.5 text-[10px]">{isoWeek(week[0])}</span> : null}
            {week.map((day) => {
              const list = itemsOnDay(items, day, tz);
              const extra = list.length - MAX_PER_CELL;
              return (
                <div
                  key={day}
                  onDoubleClick={() => onCreateDay(day)}
                  className={cn("flex min-h-0 min-w-0 flex-col gap-0.5 overflow-hidden border-l p-1", day.slice(0, 7) !== month && "bg-muted/30")}
                >
                  <button
                    type="button"
                    onClick={() => onOpenDay(day)}
                    className={cn(
                      "hover:bg-accent grid size-6 place-items-center self-start rounded-full text-xs",
                      day === today && "bg-primary text-primary-foreground hover:bg-primary",
                    )}
                  >
                    {Number(day.slice(8))}
                  </button>
                  {list.slice(0, MAX_PER_CELL).map((o) => {
                    const color = eventColor(o, calendars.get(o.calendarId)?.color);
                    const bar = isSpanning(o);
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => onSelect(o)}
                        className={cn(
                          "flex min-w-0 items-center gap-1 rounded px-1 text-left text-[11px] leading-5",
                          bar && "border border-l-[3px]",
                          selectedKey === o.key && "ring-ring ring-2",
                          declinedClass(o),
                        )}
                        style={bar ? chipStyle(color, o) : undefined}
                      >
                        {!bar ? <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} /> : null}
                        {!bar ? <span className="text-muted-foreground shrink-0">{formatTime(o.startAt, tz)}</span> : null}
                        <span className="truncate font-medium">{o.title || "(no title)"}</span>
                        <ChipIcons o={o} />
                      </button>
                    );
                  })}
                  {extra > 0 ? (
                    <button type="button" onClick={() => onOpenDay(day)} className="text-muted-foreground hover:text-foreground px-1 text-left text-[11px]">
                      +{extra} more
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
