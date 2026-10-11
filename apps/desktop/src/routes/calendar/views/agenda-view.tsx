import { CalendarX2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, daysBetween, formatDay, formatTime, type CalendarItem, type Occurrence } from "../calendar-api";
import { ChipIcons, declinedClass } from "./event-chip";
import { eventColor, isSpanning, itemsOnDay } from "./layout";

interface AgendaViewProps {
  start: string;
  end: string;
  today: string;
  tz: string;
  items: Occurrence[];
  calendars: Map<string, CalendarItem>;
  selectedKey: string | null;
  onSelect: (o: Occurrence) => void;
}

export function AgendaView({ start, end, today, tz, items, calendars, selectedKey, onSelect }: AgendaViewProps) {
  const days = Array.from({ length: daysBetween(start, end) }, (_, i) => addDays(start, i))
    .map((day) => ({ day, list: itemsOnDay(items, day, tz) }))
    .filter((d) => d.list.length);

  if (!days.length) {
    return (
      <div className="text-muted-foreground m-auto flex flex-col items-center gap-2 text-sm">
        <CalendarX2 size={18} /> Nothing scheduled in the next 30 days.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
      {days.map(({ day, list }) => (
        <div key={day} className="grid grid-cols-[120px_1fr] gap-4 border-b py-3">
          <div className={cn("flex items-baseline gap-2", day === today && "text-primary")}>
            <span className="text-2xl font-semibold tabular-nums">{Number(day.slice(8))}</span>
            <span className="text-muted-foreground text-xs uppercase">{formatDay(day, { weekday: "short", month: "short" })}</span>
          </div>
          <div className="flex flex-col gap-1">
            {list.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => onSelect(o)}
                className={cn(
                  "hover:bg-accent/50 flex items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm",
                  selectedKey === o.key && "bg-accent",
                  declinedClass(o),
                )}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: eventColor(o, calendars.get(o.calendarId)?.color) }} />
                <span className="text-muted-foreground w-36 shrink-0 text-xs tabular-nums">
                  {isSpanning(o) ? "All day" : `${formatTime(o.startAt, tz)} – ${formatTime(o.endAt, tz)}`}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{o.title || "(no title)"}</span>
                {o.location ? <span className="text-muted-foreground hidden max-w-48 truncate text-xs md:inline">{o.location}</span> : null}
                <ChipIcons o={o} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
