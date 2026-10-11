import { formatDay, weekday } from "../calendar-api";

export type RepeatPreset = "none" | "daily" | "weekdays" | "weekly" | "monthly_date" | "monthly_nth" | "yearly" | "custom";

export interface CustomRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  byday: string[];
  end: "never" | "until" | "count";
  until: string;
  count: number;
}

const CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const ORDINAL = ["first", "second", "third", "fourth", "last"];

function nth(date: string): number {
  const day = Number(date.slice(8));
  const n = Math.ceil(day / 7);
  const nextWeek = new Date(`${date}T00:00:00Z`);
  nextWeek.setUTCDate(day + 7);
  return nextWeek.getUTCMonth() !== new Date(`${date}T00:00:00Z`).getUTCMonth() && n >= 4 ? -1 : n;
}

export function presetLabel(preset: RepeatPreset, startDate: string): string {
  const wd = formatDay(startDate, { weekday: "long" });
  switch (preset) {
    case "none":
      return "Does not repeat";
    case "daily":
      return "Every day";
    case "weekdays":
      return "Every weekday (Mon–Fri)";
    case "weekly":
      return `Weekly on ${wd}`;
    case "monthly_date":
      return `Monthly on day ${Number(startDate.slice(8))}`;
    case "monthly_nth": {
      const n = nth(startDate);
      return `Monthly on the ${ORDINAL[n === -1 ? 4 : n - 1]} ${wd}`;
    }
    case "yearly":
      return `Annually on ${formatDay(startDate, { month: "long", day: "numeric" })}`;
    case "custom":
      return "Custom…";
  }
}

export function defaultCustom(startDate: string): CustomRule {
  return { freq: "WEEKLY", interval: 1, byday: [CODES[weekday(startDate)]], end: "never", until: "", count: 10 };
}

/** Builds RRULE lines from the editor choice; EXDATE lines from an existing series are kept by the caller. */
export function buildRrule(preset: RepeatPreset, startDate: string, custom: CustomRule): string[] | null {
  const code = CODES[weekday(startDate)];
  switch (preset) {
    case "none":
      return null;
    case "daily":
      return ["RRULE:FREQ=DAILY"];
    case "weekdays":
      return ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"];
    case "weekly":
      return [`RRULE:FREQ=WEEKLY;BYDAY=${code}`];
    case "monthly_date":
      return [`RRULE:FREQ=MONTHLY;BYMONTHDAY=${Number(startDate.slice(8))}`];
    case "monthly_nth":
      return [`RRULE:FREQ=MONTHLY;BYDAY=${nth(startDate)}${code}`];
    case "yearly":
      return ["RRULE:FREQ=YEARLY"];
    case "custom": {
      const parts = [`FREQ=${custom.freq}`];
      if (custom.interval > 1) parts.push(`INTERVAL=${custom.interval}`);
      if (custom.freq === "WEEKLY" && custom.byday.length) parts.push(`BYDAY=${custom.byday.join(",")}`);
      if (custom.end === "until" && custom.until) parts.push(`UNTIL=${custom.until.replace(/-/g, "")}T235959Z`);
      if (custom.end === "count" && custom.count > 0) parts.push(`COUNT=${custom.count}`);
      return [`RRULE:${parts.join(";")}`];
    }
  }
}

/** Best-effort mapping of an existing rule back to an editor preset. */
export function parseRrule(lines: string[] | null, startDate: string): { preset: RepeatPreset; custom: CustomRule } {
  const rule = lines?.find((l) => l.toUpperCase().startsWith("RRULE"));
  const custom = defaultCustom(startDate);
  if (!rule) return { preset: "none", custom };
  const kv = Object.fromEntries(
    rule
      .slice(rule.indexOf(":") + 1)
      .split(";")
      .map((p) => p.split("=") as [string, string]),
  );
  const code = CODES[weekday(startDate)];
  custom.freq = (kv.FREQ as CustomRule["freq"]) ?? "WEEKLY";
  custom.interval = Number(kv.INTERVAL ?? 1);
  custom.byday = kv.BYDAY ? kv.BYDAY.split(",").map((d: string) => d.replace(/^[-+]?\d+/, "")) : custom.byday;
  if (kv.UNTIL) {
    custom.end = "until";
    custom.until = `${kv.UNTIL.slice(0, 4)}-${kv.UNTIL.slice(4, 6)}-${kv.UNTIL.slice(6, 8)}`;
  } else if (kv.COUNT) {
    custom.end = "count";
    custom.count = Number(kv.COUNT);
  }
  const simple = !kv.INTERVAL && !kv.UNTIL && !kv.COUNT;
  if (simple && kv.FREQ === "DAILY" && !kv.BYDAY) return { preset: "daily", custom };
  if (simple && kv.FREQ === "WEEKLY" && kv.BYDAY === "MO,TU,WE,TH,FR") return { preset: "weekdays", custom };
  if (simple && kv.FREQ === "WEEKLY" && (kv.BYDAY ?? code) === code) return { preset: "weekly", custom };
  if (simple && kv.FREQ === "MONTHLY" && kv.BYMONTHDAY === String(Number(startDate.slice(8)))) return { preset: "monthly_date", custom };
  if (simple && kv.FREQ === "MONTHLY" && kv.BYDAY === `${nth(startDate)}${code}`) return { preset: "monthly_nth", custom };
  if (simple && kv.FREQ === "YEARLY" && !kv.BYMONTH) return { preset: "yearly", custom };
  return { preset: "custom", custom };
}

export const WEEKDAY_CODES = CODES;
