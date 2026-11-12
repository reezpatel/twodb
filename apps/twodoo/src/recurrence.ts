/**
 * Recurrence engine — a compact RRULE subset, no external dep.
 *
 * Stored rule format (text column task.recurrence_rule):
 *   FREQ=DAILY|WEEKLY|MONTHLY;INTERVAL=n;BYDAY=MO,TU,...;COUNT=n;UNTIL=ISO-date
 *
 * Supported grammar (mirrored by the webapp quick-add parser):
 *   daily / every day / every N days
 *   weekly / every week / every mon,wed / mon (shorthand weekly)
 *   every N weeks [on days]
 *   monthly / every N months / every month on the 12th  (v1: same day-of-month)
 *
 * Expansion is naive local-time date arithmetic (matches TickTick behavior
 * for typical personal rules; DST edge cases shift an hour at most).
 */

export interface RecurrenceRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  byDay: number[]; // 0=Sun … 6=Sat, WEEKLY only
  count: number | null;
  until: string | null; // YYYY-MM-DD inclusive
}

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_TOKENS = new Set([...DAY_NAMES, "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);

export function parseRule(rule: string | null | undefined): RecurrenceRule | null {
  if (!rule) return null;
  const out: RecurrenceRule = { freq: "DAILY", interval: 1, byDay: [], count: null, until: null };
  for (const part of rule.split(";")) {
    const [k, v] = part.split("=");
    if (!k || v === undefined) continue;
    switch (k.toUpperCase()) {
      case "FREQ": {
        const f = v.toUpperCase();
        if (f === "DAILY" || f === "WEEKLY" || f === "MONTHLY") out.freq = f;
        break;
      }
      case "INTERVAL":
        out.interval = Math.max(1, Number(v) || 1);
        break;
      case "BYDAY": {
        const days = v
          .split(",")
          .map((d) => DAY_NAMES.indexOf(d.trim().toLowerCase().slice(0, 3)))
          .filter((d) => d >= 0);
        if (days.length) out.byDay = [...new Set(days)].sort();
        break;
      }
      case "COUNT":
        out.count = Math.max(1, Number(v) || 1);
        break;
      case "UNTIL":
        out.until = v.slice(0, 10);
        break;
    }
  }
  return out;
}

export function formatRule(rule: RecurrenceRule): string {
  const parts = [`FREQ=${rule.freq}`, `INTERVAL=${rule.interval}`];
  if (rule.byDay.length) parts.push(`BYDAY=${rule.byDay.map((d) => DAY_NAMES[d].toUpperCase()).join(",")}`);
  if (rule.count != null) parts.push(`COUNT=${rule.count}`);
  if (rule.until) parts.push(`UNTIL=${rule.until}`);
  return parts.join(";");
}

/** Human label for UI ("Every Mon, Wed", "Every 2 weeks", "Monthly"). */
export function describeRule(rule: string | null | undefined): string | null {
  const r = parseRule(rule);
  if (!r) return null;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const every = r.interval > 1 ? `Every ${r.interval} ` : "";
  if (r.freq === "DAILY") return r.interval === 1 ? "Daily" : `Every ${r.interval} days`;
  if (r.freq === "WEEKLY") {
    const days = r.byDay.length ? ` ${r.byDay.map((d) => dayNames[d]).join(", ")}` : "";
    return `${every}${r.interval > 1 ? "weeks" : "Weekly"}${days}`.replace("Weekly", "Weekly").trim();
  }
  return r.interval === 1 ? "Monthly" : `Every ${r.interval} months`;
}

/** Next occurrence strictly after `from`, same local time-of-day. */
export function nextOccurrence(ruleStr: string | null | undefined, from: Date): Date | null {
  const rule = parseRule(ruleStr);
  if (!rule) return null;
  if (rule.until && startOfDay(from) > new Date(`${rule.until}T23:59:59`)) return null;

  const d = new Date(from.getTime());
  const hour = d.getHours();
  const minute = d.getMinutes();
  const second = d.getSeconds();

  // Bump to next candidate preserving time-of-day.
  const reset = (candidate: Date) => {
    candidate.setHours(hour, minute, second, 0);
    return candidate;
  };

  if (rule.freq === "DAILY") {
    d.setDate(d.getDate() + rule.interval);
    return reset(d);
  }

  if (rule.freq === "WEEKLY") {
    // If BYDAY set: find next matching weekday (possibly this week, later day).
    if (rule.byDay.length) {
      for (let i = 1; i <= 7 * rule.interval + 7; i++) {
        const cand = new Date(d.getTime());
        cand.setDate(cand.getDate() + i);
        if (rule.byDay.includes(cand.getDay())) {
          // Weekly interval: also respect interval by only matching weeks that
          // are a multiple of interval away from the anchor week.
          if (rule.interval === 1 || weeksBetween(d, cand) % rule.interval === 0) return reset(cand);
        }
      }
      return null;
    }
    d.setDate(d.getDate() + 7 * rule.interval);
    return reset(d);
  }

  // MONTHLY: same day-of-month, interval months apart.
  d.setMonth(d.getMonth() + rule.interval);
  return reset(d);
}

/** Apply COUNT/UNTIL limits: can this completed instance still spawn a next one? */
export function canRecur(ruleStr: string | null | undefined, completedCount: number): boolean {
  const rule = parseRule(ruleStr);
  if (!rule) return false;
  if (rule.count != null && completedCount >= rule.count) return false;
  return true;
}

function weeksBetween(a: Date, b: Date): number {
  const sunA = startOfDay(a).getTime() - a.getDay() * 86400000;
  const sunB = startOfDay(b).getTime() - b.getDay() * 86400000;
  return Math.round((sunB - sunA) / (7 * 86400000));
}

export function startOfDay(d: Date): Date {
  const out = new Date(d.getTime());
  out.setHours(0, 0, 0, 0);
  return out;
}

export function isDayToken(token: string): boolean {
  return DAY_TOKENS.has(token.toLowerCase());
}
