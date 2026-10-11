import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDay, formatTime, fromWall, toWall } from "../calendar-api";
import { useFindATime } from "./use-find-a-time";

interface FindATimeProps {
  calendarId: string;
  attendees: string[];
  durationMin: number;
  day: string;
  tz: string;
  selected: { start: Date; end: Date } | null;
  onPick: (start: Date, end: Date) => void;
}

const START_H = 7;
const END_H = 20;

/** Busy lanes for each guest on the chosen day + suggested slots where everyone is free. */
export function FindATime({ calendarId, attendees, durationMin, day, tz, selected, onPick }: FindATimeProps) {
  const q = useFindATime({ calendarId, attendees, durationMin, day, tz, enabled: true });
  const dayStart = fromWall(day, START_H * 60, tz).getTime();
  const dayEnd = fromWall(day, END_H * 60, tz).getTime();
  const pct = (t: number) => `${Math.min(100, Math.max(0, ((t - dayStart) / (dayEnd - dayStart)) * 100))}%`;

  if (q.isLoading) return <Loader2 className="text-muted-foreground animate-spin" size={16} />;
  if (q.error) return <p className="text-destructive text-xs">{q.error.message}</p>;
  const data = q.data;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-col gap-1.5">
        <div className="text-muted-foreground flex justify-between pl-40 text-[10px]">
          {[START_H, 10, 13, 16, END_H].map((h) => (
            <span key={h}>{formatTime(fromWall(day, h * 60, tz).toISOString(), tz)}</span>
          ))}
        </div>
        {Object.entries(data.busy).map(([email, fb]) => (
          <div key={email} className="flex items-center gap-2">
            <span className="w-38 truncate text-xs" title={email}>
              {email}
            </span>
            <div className="bg-muted/40 relative h-4 flex-1 overflow-hidden rounded">
              {fb.source === "unavailable" ? (
                <span className="text-muted-foreground absolute inset-0 grid place-items-center text-[10px]">availability unknown</span>
              ) : null}
              {fb.busy
                .filter((b) => new Date(b.end).getTime() > dayStart && new Date(b.start).getTime() < dayEnd)
                .map((b) => (
                  <span
                    key={b.start}
                    className="bg-primary/60 absolute inset-y-0"
                    style={{ left: pct(new Date(b.start).getTime()), right: `calc(100% - ${pct(new Date(b.end).getTime())})` }}
                  />
                ))}
              {selected ? (
                <span
                  className="border-ring absolute inset-y-0 border-2"
                  style={{ left: pct(selected.start.getTime()), right: `calc(100% - ${pct(selected.end.getTime())})` }}
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">Suggested times</span>
        {!data.slots.length ? <span className="text-muted-foreground text-xs">No common free slot in your working hours this week.</span> : null}
        <div className="flex flex-wrap gap-1.5">
          {data.slots.map((s) => (
            <Button key={s.start} type="button" size="xs" variant="outline" onClick={() => onPick(new Date(s.start), new Date(s.end))}>
              {formatDay(toWall(s.start, tz).date, { weekday: "short", day: "numeric" })} {formatTime(s.start, tz)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
