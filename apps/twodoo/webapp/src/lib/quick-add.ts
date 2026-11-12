/** Shared with twodoo-client.ts (kept local — avoids a cross-file import that trips this runner's tsc). */
export type Priority = "none" | "low" | "medium" | "high" | "urgent";

/**
 * Smart quick-add parser — TickTick-style natural syntax.
 *
 * Grammar (all optional, order-free, stripped from the title):
 *   #tag        → tags (also matched against list names → target list)
 *   @person     → assignee (captured; inert in single-user v1)
 *   ! / !! / !!!/ !!!!  → low / medium / high / urgent priority
 *   date/time   → today, tomorrow, mon…sun, next mon, 16 jun, jun 16,
 *                 in 3 days/weeks/hours, 5pm, 17:30, 9-11 ranges,
 *                 "today 9-11" combos, "next week", "next month"
 *   recurrence  → daily, every day, weekly, every week, every mon[/wed…],
 *                 every 2 days/weeks/months, monthly
 *
 * Returns the clean title plus extracted fields; unmatched words stay in
 * the title. Pure function — used by QuickAddBar for live chips and by the
 * create flow to build the API payload.
 */

export interface ParsedQuickAdd {
  title: string;
  tags: string[];
  assignee: string | null;
  priority: Priority;
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
  recurrenceRule: string | null;
  matchedText: string[];
}

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_FULL = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function isDayToken(t: string): number | null {
  const lower = t.toLowerCase();
  const i3 = DAY_NAMES.indexOf(lower.slice(0, 3));
  if (i3 >= 0 && (lower === DAY_NAMES[i3] || lower === DAY_FULL[i3])) return i3;
  return null;
}

function isMonthToken(t: string): number | null {
  const i = MONTHS.indexOf(t.toLowerCase());
  return i >= 0 ? i : null;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function atTime(day: Date, hh: number, mm = 0): Date {
  const c = new Date(day);
  c.setHours(hh, mm, 0, 0);
  return c;
}

interface TimeParts {
  hour: number;
  minute: number;
}

function parseTime(token: string): TimeParts | null {
  const m = token.toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const mer = m[3];
  if (mer === "pm" && hour < 12) hour += 12;
  if (mer === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function parseQuickAdd(raw: string, knownListNames: string[] = []): ParsedQuickAdd {
  const out: ParsedQuickAdd = {
    title: "",
    tags: [],
    assignee: null,
    priority: "none",
    startAt: null,
    endAt: null,
    allDay: true,
    recurrenceRule: null,
    matchedText: [],
  };

  // tokenize preserving positions; we rebuild the title from leftovers
  const tokens = raw.split(/\s+/).filter(Boolean);
  const keep: string[] = [];

  let date: Date | null = null;
  let endTime: TimeParts | null = null;
  let startTime: TimeParts | null = null;
  const weekdays: number[] = [];
  const lowerLists = knownListNames.map((n) => n.toLowerCase());

  const take = (i: number): string => tokens[i] ?? "";

  let i = 0;
  while (i < tokens.length) {
    const t = take(i);
    const lower = t.toLowerCase();

    // --- tags / lists (#)
    if (lower.startsWith("#") && lower.length > 1) {
      const name = t.slice(1).replace(/[.,!?;:]+$/, "");
      const listHit = lowerLists.indexOf(name.toLowerCase());
      if (listHit >= 0) {
        out.tags.push(`@list:${knownListNames[listHit]}`);
        out.matchedText.push(t);
        i++;
        continue;
      }
      out.tags.push(name);
      out.matchedText.push(t);
      i++;
      continue;
    }

    // --- assignee (@)
    if (lower.startsWith("@") && lower.length > 1) {
      out.assignee = t.slice(1).replace(/[.,!?;:]+$/, "");
      out.matchedText.push(t);
      i++;
      continue;
    }

    // --- priority (!..!!!!)
    if (/^!{1,4}$/.test(t)) {
      out.priority = (["low", "medium", "high", "urgent"] as const)[t.length - 1];
      out.matchedText.push(t);
      i++;
      continue;
    }

    // --- recurrence phrases
    const rec = matchRecurrence(tokens, i);
    if (rec) {
      out.recurrenceRule = rec.rule;
      out.matchedText.push(...rec.consumed);
      i += rec.consumed.length;
      continue;
    }

    // --- date phrases
    const dateMatch = matchDatePhrase(tokens, i);
    if (dateMatch) {
      date = dateMatch.date;
      out.matchedText.push(...dateMatch.consumed);
      i += dateMatch.consumed.length;
      continue;
    }

    // --- bare time (5pm / 17:30) applies to date (default today)
    const time = parseTime(t);
    if (time && (t.toLowerCase().endsWith("am") || t.toLowerCase().endsWith("pm") || t.includes(":"))) {
      startTime = time;
      out.matchedText.push(t);
      i++;
      continue;
    }

    // --- time range "9-11" / "9am-11am" / "9:30-11:45"
    const range = t.match(/^(\d{1,2}(?::\d{2})?(?:am|pm)?)-(\d{1,2}(?::\d{2})?(?:am|pm)?)$/i);
    if (range) {
      const a = parseTime(range[1]);
      const b = parseTime(range[2]);
      if (a && b) {
        startTime = a;
        endTime = b;
        out.matchedText.push(t);
        i++;
        continue;
      }
    }

    keep.push(t);
    i++;
  }

  if (date) {
    if (startTime) {
      out.allDay = false;
      out.startAt = atTime(date, startTime.hour, startTime.minute).toISOString();
      out.endAt = endTime
        ? atTime(date, endTime.hour, endTime.minute).toISOString()
        : out.startAt;
    } else {
      out.allDay = true;
      out.startAt = startOfDay(date).toISOString();
      out.endAt = out.startAt;
    }
  }

  out.title = keep.join(" ").trim();
  return out;
}

// --- date phrase matching --------------------------------------------------------

function matchDatePhrase(tokens: string[], i: number): { date: Date; consumed: string[] } | null {
  const t = (tokens[i] ?? "").toLowerCase();
  const t2 = (tokens[i + 1] ?? "").toLowerCase();
  const t3 = (tokens[i + 2] ?? "").toLowerCase();
  const today = startOfDay(new Date());

  // "in 3 days" / "in 2 weeks" / "in 3 hours" / "in a week"
  if (t === "in") {
    const n = /^\d+$/.test(t2) ? Number(t2) : t2 === "a" || t2 === "an" ? 1 : null;
    if (n != null) {
      const unit = t3.replace(/s$/, "");
      if (unit === "day") return { date: addDays(today, n), consumed: tokens.slice(i, i + 3) };
      if (unit === "week") return { date: addDays(today, n * 7), consumed: tokens.slice(i, i + 3) };
      if (unit === "month") return { date: addMonths(today, n), consumed: tokens.slice(i, i + 3) };
    }
  }

  if (t === "today" || t === "tod") return { date: today, consumed: [tokens[i]] };
  if (t === "tomorrow" || t === "tmr" || t === "tom") return { date: addDays(today, 1), consumed: [tokens[i]] };
  if (t === "yesterday") return { date: addDays(today, -1), consumed: [tokens[i]] };

  if (t === "next") {
    const day = isDayToken(t2);
    if (day != null) return { date: nextWeekday(today, day, true), consumed: tokens.slice(i, i + 2) };
    if (t2 === "week") return { date: nextWeekStart(today), consumed: tokens.slice(i, i + 2) };
    if (t2 === "month") return { date: new Date(today.getFullYear(), today.getMonth() + 1, 1), consumed: tokens.slice(i, i + 2) };
    if (t2 === "year") return { date: new Date(today.getFullYear() + 1, 0, 1), consumed: tokens.slice(i, i + 2) };
  }

  // bare weekday → next occurrence (today counts if later-or-equal)
  const day = isDayToken(t);
  if (day != null) return { date: nextWeekday(today, day, false), consumed: [tokens[i]] };

  // "16 jun" / "jun 16" / "16 june"
  const dnum = /^(\d{1,2})[.,]?$/.exec(t);
  const mAfter = dnum ? isMonthToken(t2) : null;
  if (dnum && mAfter != null) return { date: monthDay(mAfter, Number(dnum[1])), consumed: tokens.slice(i, i + 2) };
  const mBefore = isMonthToken(t);
  const dnum2 = mBefore != null ? /^(\d{1,2})[.,]?$/.exec(t2) : null;
  if (mBefore != null && dnum2) return { date: monthDay(mBefore, Number(dnum2[1])), consumed: tokens.slice(i, i + 2) };

  return null;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function addMonths(d: Date, n: number): Date {
  const c = new Date(d);
  c.setMonth(c.getMonth() + n);
  return c;
}

function nextWeekday(from: Date, weekday: number, forceNextWeek: boolean): Date {
  const c = startOfDay(from);
  let delta = (weekday - c.getDay() + 7) % 7;
  if (delta === 0 && !forceNextWeek) return c; // "mon" on a monday = today
  if (forceNextWeek && delta === 0) delta = 7;
  if (forceNextWeek && delta < 7) {
    // "next mon" = monday of next week strictly
    delta = delta === 0 ? 7 : ((7 - ((c.getDay() - weekday + 7) % 7)) % 7) || 7;
  }
  return addDays(c, delta);
}

function nextWeekStart(from: Date): Date {
  const c = startOfDay(from);
  const monday = addDays(c, -((c.getDay() + 6) % 7));
  return addDays(monday, 7);
}

function monthDay(month: number, day: number): Date {
  const now = new Date();
  const year = now.getFullYear();
  let d = new Date(year, month, day);
  if (d < startOfDay(now)) d = new Date(year + 1, month, day);
  return d;
}

// --- recurrence matching -----------------------------------------------------------

function matchRecurrence(tokens: string[], i: number): { rule: string; consumed: string[] } | null {
  const t = (tokens[i] ?? "").toLowerCase();
  const t2 = (tokens[i + 1] ?? "").toLowerCase();
  const t3 = (tokens[i + 2] ?? "").toLowerCase();

  // "every N days/weeks/months"
  if (t === "every" && /^\d+$/.test(t2)) {
    const n = Number(t2);
    const unit = t3.replace(/s$/, "");
    if (unit === "day") return { rule: `FREQ=DAILY;INTERVAL=${n}`, consumed: tokens.slice(i, i + 3) };
    if (unit === "week") return { rule: `FREQ=WEEKLY;INTERVAL=${n}`, consumed: tokens.slice(i, i + 3) };
    if (unit === "month") return { rule: `FREQ=MONTHLY;INTERVAL=${n}`, consumed: tokens.slice(i, i + 3) };
  }

  // "every day" / "every week" / "every month"
  if (t === "every" && (t2 === "day" || t2 === "week" || t2 === "month")) {
    const freq = t2 === "day" ? "DAILY" : t2 === "week" ? "WEEKLY" : "MONTHLY";
    return { rule: `FREQ=${freq};INTERVAL=1`, consumed: tokens.slice(i, i + 2) };
  }

  // "every mon" / "every mon,wed" / "every mon and wed"
  if (t === "every") {
    const days: number[] = [];
    let j = i + 1;
    let matchedAny = false;
    while (j < tokens.length) {
      const tok = (tokens[j] ?? "").toLowerCase().replace(/[,;]$/, "");
      const sep = (tokens[j] ?? "").toLowerCase().replace(/[^,;and]/g, "");
      const d = isDayToken(tok);
      if (d != null) {
        days.push(d);
        matchedAny = true;
        j++;
        // allow "and" / comma between days
        if ((tokens[j] ?? "").toLowerCase() === "and" || (tokens[j] ?? "").endsWith(",")) j++;
        continue;
      }
      void sep;
      break;
    }
    if (matchedAny) {
      const uniq = [...new Set(days)].sort().join(",");
      return { rule: `FREQ=WEEKLY;INTERVAL=1;BYDAY=${uniq}`, consumed: tokens.slice(i, j) };
    }
  }

  // "daily" / "weekly" / "monthly"
  if (t === "daily") return { rule: "FREQ=DAILY;INTERVAL=1", consumed: [tokens[i]] };
  if (t === "weekly") return { rule: "FREQ=WEEKLY;INTERVAL=1", consumed: [tokens[i]] };
  if (t === "monthly") return { rule: "FREQ=MONTHLY;INTERVAL=1", consumed: [tokens[i]] };

  // bare "mon," → weekly on that day — handled by date phrase instead (single
  // occurrence); recurrence requires the explicit every/daily/weekly form.
  void t3;
  return null;
}

// --- display helpers ------------------------------------------------------------------

/** Short human label for a recurrence rule (client-side mirror of the backend's describeRule). */
export function describeRecurrence(rule: string | null | undefined): string | null {
  if (!rule) return null;
  const parts = new Map(rule.split(";").map((p) => p.split("=") as [string, string]));
  const freq = parts.get("FREQ");
  const interval = Number(parts.get("INTERVAL") ?? 1);
  const byDay = (parts.get("BYDAY") ?? "").split(",").filter(Boolean).map((d) => DAY_NAMES.findIndex((n) => n === d.toLowerCase()));
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (freq === "DAILY") return interval === 1 ? "Daily" : `Every ${interval} days`;
  if (freq === "WEEKLY") {
    if (interval === 1) return byDay.length ? `Weekly ${byDay.map((d) => names[d]).join(", ")}` : "Weekly";
    return `Every ${interval} weeks`;
  }
  if (freq === "MONTHLY") return interval === 1 ? "Monthly" : `Every ${interval} months`;
  return rule;
}

export function formatDue(startAt: string | null, endAt: string | null, allDay: boolean): string | null {
  if (!startAt) return null;
  const s = new Date(startAt);
  const e = endAt ? new Date(endAt) : null;
  const today = startOfDay(new Date());
  const sod = startOfDay(s);
  const diff = Math.round((sod.getTime() - today.getTime()) / 86400000);
  let label: string;
  if (diff === 0) label = "Today";
  else if (diff === 1) label = "Tomorrow";
  else if (diff === -1) label = "Yesterday";
  else if (diff < 0) label = `${Math.abs(diff)}d overdue`;
  else if (diff < 7) label = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][s.getDay()];
  else label = `${s.getMonth() + 1}/${s.getDate()}`;
  if (!allDay) {
    const time = s.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (e && e.getTime() > s.getTime() && startOfDay(e).getTime() === sod.getTime()) {
      return `${label} ${time}–${e.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    }
    return `${label} ${time}`;
  }
  return label;
}
