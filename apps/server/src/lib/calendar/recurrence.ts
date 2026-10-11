import rrulePkg from "rrule";
import { addDays, dateToUtcMidnight, safeTz, utcFromWall, wallFromUtc } from "./tz";

const { RRule, RRuleSet } = rrulePkg;

// Recurrence expansion. Masters store iCalendar lines (RRULE / RDATE /
// EXDATE); expansion runs in the event's wall-clock time so a 09:00 weekly
// stays 09:00 across DST, then converts each instance back to UTC.

export interface RecurrenceSource {
  rrule: string[] | null;
  isAllDay: boolean;
  startAt: Date | null;
  endAt: Date | null;
  startDate: string | null;
  endDate: string | null;
  startTz: string | null;
}

export interface Instance {
  /** RECURRENCE-ID: the instance's original start (UTC; midnight UTC for all-day). */
  originalStart: Date;
  startAt: Date;
  endAt: Date;
  startDate: string | null;
  endDate: string | null;
}

const MAX_INSTANCES = 5000;

/** Parses an iCal date/date-time value (yyyymmdd, yyyymmddThhmmss[Z]) to a wall Date in tz. */
export function parseIcalDateValue(value: string, tz: string, valueTz?: string | null): Date | null {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const wall = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)));
  if (!m[4]) return wall;
  if (m[7]) return wallFromUtc(wall, tz);
  if (valueTz && safeTz(valueTz) !== tz) return wallFromUtc(utcFromWall(wall, safeTz(valueTz)), tz);
  return wall;
}

function formatIcalUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function splitLines(lines: string[]) {
  const rules: string[] = [];
  const exdates: { value: string; tz: string | null }[] = [];
  const rdates: { value: string; tz: string | null }[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const head = line.slice(0, idx).toUpperCase();
    const value = line.slice(idx + 1);
    const tz = head.match(/TZID=([^;:]+)/)?.[1] ?? null;
    if (head.startsWith("RRULE")) rules.push(`RRULE:${value}`);
    else if (head.startsWith("EXDATE")) for (const v of value.split(",")) exdates.push({ value: v, tz });
    else if (head.startsWith("RDATE") && !head.includes("VALUE=PERIOD")) for (const v of value.split(",")) rdates.push({ value: v, tz });
  }
  return { rules, exdates, rdates };
}

/** Expands a master into instances overlapping [from, to). */
export function expand(src: RecurrenceSource, from: Date, to: Date): Instance[] {
  if (!src.rrule?.length) return [];
  const tz = src.isAllDay ? "UTC" : safeTz(src.startTz);
  const wallStart = src.isAllDay ? dateToUtcMidnight(src.startDate!) : wallFromUtc(src.startAt!, tz);
  const durationMs = src.isAllDay
    ? dateToUtcMidnight(src.endDate ?? addDays(src.startDate!, 1)).getTime() - wallStart.getTime()
    : (src.endAt?.getTime() ?? src.startAt!.getTime()) - src.startAt!.getTime();

  const { rules, exdates, rdates } = splitLines(src.rrule);
  const excluded = new Set(exdates.map((e) => parseIcalDateValue(e.value, tz, e.tz)?.getTime()).filter((v): v is number => v !== undefined));
  // Widen the wall window by a day each side; exact overlap is checked on UTC below.
  const wallFrom = new Date(from.getTime() - durationMs - 2 * 86_400_000);
  const wallTo = new Date(to.getTime() + 2 * 86_400_000);
  const walls: Date[] = [];

  if (rules.length) {
    try {
      const set = new RRuleSet();
      for (const rule of rules) {
        const options = RRule.parseString(rule.slice(rule.indexOf(":") + 1));
        // A Z-suffixed UNTIL is a UTC instant and must move into the wall frame; floating UNTIL already is wall time.
        const utcUntil = /Z$/i.test(rule.match(/UNTIL=([^;]+)/i)?.[1] ?? "");
        if (options.until && !src.isAllDay && utcUntil) options.until = wallFromUtc(options.until, tz);
        set.rrule(new RRule({ ...options, dtstart: wallStart, tzid: null }));
      }
      walls.push(...set.between(wallFrom, wallTo, true).slice(0, MAX_INSTANCES));
    } catch {
      walls.push(wallStart);
    }
  }
  if (wallStart >= wallFrom && wallStart <= wallTo) walls.push(wallStart);
  for (const r of rdates) {
    const w = parseIcalDateValue(r.value, tz, r.tz);
    if (w && w >= wallFrom && w <= wallTo) walls.push(w);
  }

  const seen = new Set<number>();
  const out: Instance[] = [];
  for (const wall of walls.sort((a, b) => a.getTime() - b.getTime())) {
    if (seen.has(wall.getTime()) || excluded.has(wall.getTime())) continue;
    seen.add(wall.getTime());
    if (src.isAllDay) {
      const startDate = wall.toISOString().slice(0, 10);
      const endDate = new Date(wall.getTime() + durationMs).toISOString().slice(0, 10);
      const startAt = dateToUtcMidnight(startDate);
      const endAt = dateToUtcMidnight(endDate);
      if (endAt <= from || startAt >= to) continue;
      out.push({ originalStart: startAt, startAt, endAt, startDate, endDate });
    } else {
      const startAt = utcFromWall(wall, tz);
      const endAt = new Date(startAt.getTime() + durationMs);
      if (endAt <= from || startAt >= to) continue;
      out.push({ originalStart: startAt, startAt, endAt, startDate: null, endDate: null });
    }
  }
  return out;
}

/** True when an instance at `originalStart` belongs to the series (honours EXDATE). */
export function hasInstance(src: RecurrenceSource, originalStart: Date): boolean {
  const day = 86_400_000;
  return expand(src, new Date(originalStart.getTime() - day), new Date(originalStart.getTime() + day)).some(
    (i) => i.originalStart.getTime() === originalStart.getTime(),
  );
}

/** Ends the series just before `splitAt` (for "this and following"). */
export function truncateBefore(src: RecurrenceSource, splitAt: Date): string[] {
  const until = src.isAllDay ? addDays(splitAt.toISOString().slice(0, 10), -1).replace(/-/g, "") : formatIcalUtc(new Date(splitAt.getTime() - 1000));
  return (src.rrule ?? []).map((line) => {
    if (!line.toUpperCase().startsWith("RRULE")) return line;
    const value = line.slice(line.indexOf(":") + 1);
    const parts = value
      .split(";")
      .filter((p) => !/^(UNTIL|COUNT)=/i.test(p))
      .concat(`UNTIL=${until}`);
    return `RRULE:${parts.join(";")}`;
  });
}

/** Rule lines for the new series that starts at the split point (COUNT can't carry over; UNTIL and EXDATEs do). */
export function continueFrom(src: RecurrenceSource): string[] {
  return (src.rrule ?? []).map((line) => {
    if (!line.toUpperCase().startsWith("RRULE")) return line;
    const value = line.slice(line.indexOf(":") + 1);
    return `RRULE:${value
      .split(";")
      .filter((p) => !/^COUNT=/i.test(p))
      .join(";")}`;
  });
}

/** Adds an EXDATE for one instance (used for local cancellations of a series instance). */
export function withExdate(src: RecurrenceSource, originalStart: Date): string[] {
  const value = src.isAllDay ? `EXDATE;VALUE=DATE:${originalStart.toISOString().slice(0, 10).replace(/-/g, "")}` : `EXDATE:${formatIcalUtc(originalStart)}`;
  return [...(src.rrule ?? []), value];
}

/** Human summary for the UI ("Weekly on Mon, Wed"). */
export function describeRule(lines: string[] | null): string | null {
  const rule = lines?.find((l) => l.toUpperCase().startsWith("RRULE"));
  if (!rule) return null;
  try {
    return RRule.fromString(rule.replace(/^RRULE:/i, "")).toText();
  } catch {
    return "Repeats";
  }
}
