import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { addDays, formatDay, formatMinutes, fromWall, isoWeek, toWall, type CalendarItem, type CalendarSettings, type Occurrence } from "../calendar-api";
import { ChipIcons, chipStyle, declinedClass } from "./event-chip";
import { eventColor, layoutSpans, layoutTimed, type TimedBlock } from "./layout";
import { HOUR_PX, useTimeGrid } from "./use-time-grid";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

interface TimeGridProps {
  days: string[];
  items: Occurrence[];
  tz: string;
  today: string;
  settings: CalendarSettings | undefined;
  calendars: Map<string, CalendarItem>;
  selectedKey: string | null;
  canEdit: (o: Occurrence) => boolean;
  onSelect: (o: Occurrence) => void;
  onCreate: (init: { startAt?: string; endAt?: string; startDate?: string; endDate?: string; isAllDay?: boolean }) => void;
  onMove: (o: Occurrence, startAt: Date, endAt: Date) => void;
  onDayClick: (day: string) => void;
}

function useNowMinutes(tz: string) {
  const [now, setNow] = useState(() => toWall(new Date(), tz));
  useEffect(() => {
    const t = setInterval(() => setNow(toWall(new Date(), tz)), 60_000);
    return () => clearInterval(t);
  }, [tz]);
  return now;
}

function offsetLabel(tz: string) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName");
  return part?.value ?? tz;
}

export function TimeGrid({ days, items, tz, today, settings, calendars, selectedKey, canEdit, onSelect, onCreate, onMove, onDayClick }: TimeGridProps) {
  const now = useNowMinutes(tz);
  const timed = layoutTimed(items, days, tz);
  const spans = layoutSpans(items, days, tz);
  const spanRows = spans.reduce((m, b) => Math.max(m, b.row + 1), 0);
  const secondary = settings?.secondaryTimezone && settings.secondaryTimezone !== tz ? settings.secondaryTimezone : null;
  const secondaryShift = secondary
    ? (() => {
        const ref = fromWall(today, 12 * 60, tz);
        return toWall(ref, secondary).minutes - 12 * 60 + (toWall(ref, secondary).date > today ? 1440 : toWall(ref, secondary).date < today ? -1440 : 0);
      })()
    : 0;

  const grid = useTimeGrid({
    days,
    canEdit,
    onSelect,
    onCreate: (day, startMin, endMin) =>
      onCreate({ startAt: fromWall(day, startMin, tz).toISOString(), endAt: fromWall(day, Math.min(endMin, 1440), tz).toISOString() }),
    onMove: (block, dayDelta, minDelta) => {
      const o = block.occurrence;
      const start = new Date(new Date(o.startAt).getTime() + (dayDelta * 1440 + minDelta) * 60_000);
      const end = new Date(new Date(o.endAt).getTime() + (dayDelta * 1440 + minDelta) * 60_000);
      onMove(o, start, end);
    },
    onResize: (block, endMin) => {
      const o = block.occurrence;
      onMove(o, new Date(o.startAt), fromWall(block.day, Math.min(endMin, 1440), tz));
    },
  });

  const working = (day: string) => {
    const wd = new Date(`${day}T00:00:00Z`).getUTCDay();
    const hours = settings?.workingHours.find((w) => w.day === wd);
    if (!hours) return null;
    const [sh, sm] = hours.start.split(":").map(Number);
    const [eh, em] = hours.end.split(":").map(Number);
    return { start: sh * 60 + sm, end: eh * 60 + em };
  };

  const cols = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };
  const gutter = secondary ? "grid-cols-[48px_56px_1fr]" : "grid-cols-[56px_1fr]";

  const renderBlock = (b: TimedBlock, ghost?: { top: number; height: number; dayShift: number }) => {
    const o = b.occurrence;
    const color = eventColor(o, calendars.get(o.calendarId)?.color);
    const top = ghost?.top ?? (b.startMin / 60) * HOUR_PX;
    const height = Math.max(ghost?.height ?? ((b.endMin - b.startMin) / 60) * HOUR_PX, 18);
    const short = height < 36;
    const past = settings?.dimPast !== false && new Date(o.endAt).getTime() < Date.now();
    return (
      <div
        key={`${o.key}:${b.day}${ghost ? ":ghost" : ""}`}
        role="button"
        tabIndex={0}
        onPointerDown={ghost ? undefined : (e) => grid.onBlockPointerDown(e, b)}
        onKeyDown={(e) => e.key === "Enter" && onSelect(o)}
        className={cn(
          "absolute z-10 flex cursor-pointer flex-col overflow-hidden rounded-md border border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight select-none",
          selectedKey === o.key && "ring-ring ring-2",
          past && "opacity-60",
          ghost && "pointer-events-none z-20 opacity-80 shadow-lg",
          declinedClass(o),
        )}
        style={{
          top,
          height: height - 2,
          left: `calc(${(b.column / b.columns) * 100}% + 1px)`,
          width: `calc(${100 / b.columns}% - 3px)`,
          ...chipStyle(color, o),
        }}
      >
        <span className={cn("flex min-w-0 items-center gap-1", short && "gap-1.5")}>
          <strong className="truncate font-semibold">{o.title || "(no title)"}</strong>
          <ChipIcons o={o} />
          {short ? <span className="text-muted-foreground shrink-0">{formatMinutes(b.startMin)}</span> : null}
        </span>
        {!short ? (
          <span className="text-muted-foreground truncate">
            {formatMinutes(b.startMin)} – {formatMinutes(b.endMin % 1440)}
            {o.location ? ` · ${o.location}` : ""}
          </span>
        ) : null}
        {!ghost && canEdit(o) && !b.clippedEnd ? (
          <span className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize" onPointerDown={(e) => grid.onResizePointerDown(e, b)} />
        ) : null}
      </div>
    );
  };

  const d = grid.drag;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn("grid border-b", gutter)}>
        {secondary ? <span className="text-muted-foreground self-end px-1 pb-1 text-[10px]">{offsetLabel(secondary)}</span> : null}
        <span className="text-muted-foreground self-end px-1 pb-1 text-[10px]">{settings?.showWeekNumbers ? `W${isoWeek(days[0])}` : offsetLabel(tz)}</span>
        <div className="grid" style={cols}>
          {days.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => onDayClick(day)}
              className={cn("flex items-baseline gap-1.5 border-l px-2 py-1.5 text-left", day === today && "text-primary")}
            >
              <span className="text-muted-foreground text-xs uppercase">{formatDay(day, { weekday: "short" })}</span>
              <span className={cn("grid size-7 place-items-center rounded-full text-lg font-semibold", day === today && "bg-primary text-primary-foreground")}>
                {Number(day.slice(8))}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={cn("grid border-b", gutter)}>
        {secondary ? <span /> : null}
        <span className="text-muted-foreground px-1 py-1 text-[10px]">all-day</span>
        <div
          className="relative grid min-h-7"
          style={{ ...cols, height: Math.max(1, spanRows) * 22 + 6 }}
          onDoubleClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const i = Math.floor(((e.clientX - rect.left) / rect.width) * days.length);
            onCreate({ isAllDay: true, startDate: days[i], endDate: addDays(days[i], 1) });
          }}
        >
          {days.map((day) => (
            <div key={day} className="border-l" />
          ))}
          {spans.map((b) => {
            const color = eventColor(b.occurrence, calendars.get(b.occurrence.calendarId)?.color);
            return (
              <button
                key={b.occurrence.key}
                type="button"
                onClick={() => onSelect(b.occurrence)}
                className={cn(
                  "absolute flex h-5 items-center gap-1 truncate rounded border border-l-[3px] px-1.5 text-left text-[11px] font-medium",
                  selectedKey === b.occurrence.key && "ring-ring ring-2",
                  b.clippedStart && "rounded-l-none",
                  b.clippedEnd && "rounded-r-none",
                  declinedClass(b.occurrence),
                )}
                style={{
                  top: b.row * 22 + 3,
                  left: `calc(${(b.startIndex / days.length) * 100}% + 2px)`,
                  width: `calc(${(b.span / days.length) * 100}% - 4px)`,
                  ...chipStyle(color, b.occurrence),
                }}
              >
                <span className="truncate">{b.occurrence.title || "(no title)"}</span>
                <ChipIcons o={b.occurrence} />
              </button>
            );
          })}
        </div>
      </div>

      <div ref={grid.scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn("grid", gutter)} style={{ height: 24 * HOUR_PX }}>
          {secondary ? (
            <div className="relative border-r">
              {HOURS.map((h) => (
                <span key={h} className="text-muted-foreground/70 absolute right-1 -translate-y-1/2 text-[10px]" style={{ top: h * HOUR_PX }}>
                  {h ? formatMinutes((((h * 60 + secondaryShift) % 1440) + 1440) % 1440) : ""}
                </span>
              ))}
            </div>
          ) : null}
          <div className="relative">
            {HOURS.map((h) => (
              <span key={h} className="text-muted-foreground absolute right-1.5 -translate-y-1/2 text-[10px]" style={{ top: h * HOUR_PX }}>
                {h ? formatMinutes(h * 60) : ""}
              </span>
            ))}
          </div>
          <div ref={grid.columnsRef} className="relative grid" style={cols} onPointerDown={grid.onColumnPointerDown}>
            {days.map((day, i) => {
              const wh = working(day);
              return (
                <div key={day} className="relative border-l">
                  {HOURS.map((h) => (
                    <div key={h} className="border-border/60 absolute inset-x-0 border-t" style={{ top: h * HOUR_PX }} />
                  ))}
                  {wh ? (
                    <>
                      <div className="bg-muted/40 pointer-events-none absolute inset-x-0 top-0" style={{ height: (wh.start / 60) * HOUR_PX }} />
                      <div className="bg-muted/40 pointer-events-none absolute inset-x-0 bottom-0" style={{ top: (wh.end / 60) * HOUR_PX }} />
                    </>
                  ) : (
                    <div className="bg-muted/40 pointer-events-none absolute inset-0" />
                  )}
                  {(timed.get(day) ?? []).map((b) =>
                    (d?.kind === "move" && d.block.occurrence.key === b.occurrence.key) ||
                    (d?.kind === "resize" && d.block.occurrence.key === b.occurrence.key && d.block.day === b.day)
                      ? null
                      : renderBlock(b),
                  )}
                  {d?.kind === "move" && days.indexOf(d.block.day) + d.dayDelta === i
                    ? renderBlock(
                        { ...d.block, column: 0, columns: 1 },
                        {
                          top: ((d.block.startMin + d.minDelta) / 60) * HOUR_PX,
                          height: ((d.block.endMin - d.block.startMin) / 60) * HOUR_PX,
                          dayShift: d.dayDelta,
                        },
                      )
                    : null}
                  {d?.kind === "resize" && d.block.day === day
                    ? renderBlock(d.block, { top: (d.block.startMin / 60) * HOUR_PX, height: ((d.endMin - d.block.startMin) / 60) * HOUR_PX, dayShift: 0 })
                    : null}
                  {d?.kind === "create" && d.dayIndex === i ? (
                    <div
                      className="bg-primary/20 border-primary pointer-events-none absolute inset-x-1 z-20 rounded-md border px-1.5 text-[11px]"
                      style={{ top: (d.startMin / 60) * HOUR_PX, height: ((d.endMin - d.startMin) / 60) * HOUR_PX }}
                    >
                      {formatMinutes(d.startMin)} – {formatMinutes(d.endMin % 1440)}
                    </div>
                  ) : null}
                  {day === now.date ? (
                    <div className="pointer-events-none absolute inset-x-0 z-30 flex items-center" style={{ top: (now.minutes / 60) * HOUR_PX }}>
                      <span className="bg-destructive -ml-1 size-2 rounded-full" />
                      <span className="bg-destructive h-px flex-1" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
