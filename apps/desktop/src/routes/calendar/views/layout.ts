import { addDays, daysBetween, toWall, type Occurrence } from "../calendar-api";

const DAY_MIN = 24 * 60;

export interface TimedBlock {
  occurrence: Occurrence;
  day: string;
  startMin: number;
  endMin: number;
  column: number;
  columns: number;
  /** Continues from the previous / into the next day. */
  clippedStart: boolean;
  clippedEnd: boolean;
}

export interface SpanBar {
  occurrence: Occurrence;
  /** Index of the first visible day the bar covers. */
  startIndex: number;
  span: number;
  row: number;
  clippedStart: boolean;
  clippedEnd: boolean;
}

/** All-day events and timed events lasting 24h+ render as bars above the grid / in month cells. */
export function isSpanning(o: Occurrence): boolean {
  return o.isAllDay || new Date(o.endAt).getTime() - new Date(o.startAt).getTime() >= DAY_MIN * 60_000;
}

function dayRange(o: Occurrence, tz: string): { first: string; last: string } {
  if (o.isAllDay && o.startDate) return { first: o.startDate, last: addDays(o.endDate ?? addDays(o.startDate, 1), -1) };
  const s = toWall(o.startAt, tz);
  const e = toWall(new Date(new Date(o.endAt).getTime() - 1), tz);
  return { first: s.date, last: e.date < s.date ? s.date : e.date };
}

/** Timed segments per day with side-by-side columns for overlaps (Google-style). */
export function layoutTimed(items: Occurrence[], days: string[], tz: string): Map<string, TimedBlock[]> {
  const out = new Map<string, TimedBlock[]>(days.map((d) => [d, []]));
  for (const o of items) {
    if (isSpanning(o)) continue;
    const s = toWall(o.startAt, tz);
    const e = toWall(o.endAt, tz);
    for (const day of days) {
      if (day < s.date || day > e.date) continue;
      if (day === e.date && e.minutes === 0 && day !== s.date) continue;
      const startMin = day === s.date ? s.minutes : 0;
      const endMin = day === e.date ? e.minutes : DAY_MIN;
      out
        .get(day)!
        .push({
          occurrence: o,
          day,
          startMin,
          endMin: Math.max(endMin, startMin + 15),
          column: 0,
          columns: 1,
          clippedStart: day !== s.date,
          clippedEnd: day !== e.date,
        });
    }
  }
  for (const blocks of out.values()) {
    blocks.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
    let cluster: TimedBlock[] = [];
    let clusterEnd = -1;
    const flush = () => {
      const cols: number[] = [];
      for (const b of cluster) {
        let col = cols.findIndex((end) => end <= b.startMin);
        if (col < 0) {
          col = cols.length;
          cols.push(b.endMin);
        } else cols[col] = b.endMin;
        b.column = col;
      }
      for (const b of cluster) b.columns = cols.length;
      cluster = [];
    };
    for (const b of blocks) {
      if (b.startMin >= clusterEnd && cluster.length) flush();
      cluster.push(b);
      clusterEnd = Math.max(clusterEnd, b.endMin);
    }
    if (cluster.length) flush();
  }
  return out;
}

/** Bars across consecutive days, stacked into rows without overlap. */
export function layoutSpans(items: Occurrence[], days: string[], tz: string): SpanBar[] {
  if (!days.length) return [];
  const first = days[0];
  const last = days[days.length - 1];
  const bars: SpanBar[] = [];
  const sorted = items.filter(isSpanning).sort((a, b) => a.startAt.localeCompare(b.startAt) || b.endAt.localeCompare(a.endAt));
  const rows: number[] = [];
  for (const o of sorted) {
    const r = dayRange(o, tz);
    if (r.last < first || r.first > last) continue;
    const startDay = r.first < first ? first : r.first;
    const endDay = r.last > last ? last : r.last;
    const startIndex = Math.max(0, daysBetween(first, startDay));
    const span = daysBetween(startDay, endDay) + 1;
    let row = rows.findIndex((end) => end < startIndex);
    if (row < 0) {
      row = rows.length;
      rows.push(startIndex + span - 1);
    } else rows[row] = startIndex + span - 1;
    bars.push({ occurrence: o, startIndex, span, row, clippedStart: r.first < first, clippedEnd: r.last > last });
  }
  return bars;
}

/** Events touching a day, spanning first, then by start (month cells, agenda). */
export function itemsOnDay(items: Occurrence[], day: string, tz: string): Occurrence[] {
  return items
    .filter((o) => {
      const r = dayRange(o, tz);
      return r.first <= day && r.last >= day;
    })
    .sort((a, b) => Number(isSpanning(b)) - Number(isSpanning(a)) || a.startAt.localeCompare(b.startAt));
}

export function eventColor(o: Pick<Occurrence, "color">, calendarColor: string | undefined): string {
  return o.color ?? calendarColor ?? "var(--color-primary)";
}
