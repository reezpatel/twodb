import { Big, Shell } from "./WidgetBits.js";
import type { CallBucket } from "../hooks/useAnalytics.js";
import type { Connection } from "../../../lib/tworoute-client.js";

/**
 * Calls widget — real analytics: daily call buckets from /analytics/calls
 * (up to a year). Wide tile: a 53-week × 7-day GitHub-style grid where each
 * cell is one day; tone = volume, a destructive edge marks failed-only days.
 * Completed/failed split summarized in the header.
 */

const WEEKS = 53;

function dayTone(calls: number, peak: number): string {
  if (calls === 0) return "bg-ink/[0.06]";
  const r = calls / peak;
  if (r > 0.75) return "bg-ion-deep/85";
  if (r > 0.5) return "bg-ion-deep/55";
  if (r > 0.25) return "bg-ion-deep/35";
  return "bg-ion-deep/20";
}

export function CallsWidget({
  buckets,
  connections,
}: {
  buckets: CallBucket[];
  connections: Connection[];
}) {
  const byDay = new Map<string, { calls: number; completed: number; failed: number }>();
  for (const b of buckets) {
    const e = byDay.get(b.day) ?? { calls: 0, completed: 0, failed: 0 };
    e.calls += b.calls;
    e.completed += b.completed;
    e.failed += b.failed;
    byDay.set(b.day, e);
  }

  const total = [...byDay.values()].reduce((a, e) => a + e.calls, 0);
  const failed = [...byDay.values()].reduce((a, e) => a + e.failed, 0);
  const peak = Math.max(1, ...[...byDay.values()].map((e) => e.calls));

  // Build the year grid: columns = weeks (oldest → newest), rows = weekday.
  const today = new Date();
  const todayIdx = Math.floor((today.getTime() - Date.UTC(today.getUTCFullYear(), 0, 1)) / 86400000);
  const startOfYear = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const startIdx = Math.max(0, todayIdx - (WEEKS * 7 - 1));
  const days: Array<{ iso: string; entry?: { calls: number; completed: number; failed: number } }> = [];
  for (let i = startIdx; i <= todayIdx; i++) {
    const d = new Date(startOfYear.getTime() + i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    days.push({ iso, entry: byDay.get(iso) });
  }

  // month labels above the columns
  const monthMarks = days.map((d, i) => {
    const date = new Date(d.iso);
    return { col: Math.floor(i / 7), label: date.toLocaleString("en", { month: "short" }), firstOfMonth: date.getUTCDate() <= 7 };
  });

  return (
    <Shell
      title="Calls"
      meta={
        <span className="flex items-center gap-2 text-ink-muted">
          <span className="tabular-nums">{total.toLocaleString()} total</span>
          {failed > 0 ? <span className="text-destructive tabular-nums">· {failed} failed</span> : null}
        </span>
      }
    >
      <div>
        <Big>{total.toLocaleString()}</Big>
        <p className="mt-2 text-[12px] text-ink-muted">
          {failed > 0 ? `${failed} failed calls in the window` : "no failed calls"} · past year
        </p>
      </div>
      <div className="mt-auto">
        <div className="mb-1 hidden gap-[3px] px-[13px] text-[10px] text-ink-muted sm:grid" style={{ gridTemplateColumns: `repeat(${Math.ceil(days.length / 7)}, minmax(0,1fr))` }}>
          {Array.from({ length: Math.ceil(days.length / 7) }, (_, col) => {
            const mark = monthMarks.find((m) => m.col === col && m.firstOfMonth);
            return <span key={col}>{mark ? mark.label : ""}</span>;
          })}
        </div>
        <div
          role="img"
          aria-label={`Daily calls over the past year: ${total} total, ${failed} failed. Busiest day had ${peak} calls.`}
          className="grid"
          style={{ gridTemplateRows: "repeat(7, minmax(0,1fr))", gridAutoFlow: "column", gridTemplateColumns: `repeat(${Math.ceil(days.length / 7)}, minmax(0,1fr))`, gap: 3 }}
        >
          {days.map((d) => (
            <span
              key={d.iso}
              title={d.entry ? `${d.iso} · ${d.entry.calls} calls${d.entry.failed ? ` · ${d.entry.failed} failed` : ""}` : `${d.iso} · no calls`}
              className={`aspect-square rounded-[2.5px] ${d.entry && d.entry.completed === 0 && d.entry.failed > 0 ? "bg-destructive/60" : dayTone(d.entry?.calls ?? 0, peak)}`}
            />
          ))}
        </div>
      </div>
    </Shell>
  );
}
