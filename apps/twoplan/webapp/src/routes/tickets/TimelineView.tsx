import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Layers } from "lucide-react";
import { useProjectCtx } from "../../lib/project-context";
import { useEpics, useMilestones } from "../../lib/queries";
import { addDays, diffDays, formatDate, parseDate, toIsoDate } from "../../lib/format";
import { epicStatusMeta } from "../../lib/meta";
import { EmptyState } from "../../components/Visuals";
import type { Ticket } from "../../lib/types";

const ZOOMS = { day: 32, week: 14, month: 5 } as const;
const ROW = 32, LABEL_W = 280;

interface Row { id: string; label: string; sub?: string; indent: boolean; start: Date | null; end: Date | null; color: string; progress?: number; to: string; kind: "epic" | "ticket" }

/** Gantt-style view: milestone bands on top, epics with their dated tickets underneath. Click a bar to open it. */
export function TimelineView({ tickets }: { tickets: Ticket[] }) {
  const { project, status } = useProjectCtx();
  const nav = useNavigate();
  const { data: epics = [] } = useEpics(project.key);
  const { data: milestones = [] } = useMilestones(project.key);
  const [zoom, setZoom] = useState<keyof typeof ZOOMS>("week");
  const scroller = useRef<HTMLDivElement>(null);
  const dayW = ZOOMS[zoom];

  const { rows, from, to } = useMemo(() => {
    const dated = tickets.filter((t) => t.startDate || t.dueDate);
    const rows: Row[] = [];
    const ticketRow = (t: Ticket): Row => {
      const s = parseDate(t.startDate) ?? parseDate(t.dueDate)!, e = parseDate(t.dueDate) ?? s;
      return { id: t.id, label: t.title, sub: t.identifier, indent: true, start: s, end: e < s ? s : e, color: status(t.statusId)?.color ?? "#9ca3af", to: `/p/${project.key}/t/${t.identifier}`, kind: "ticket" };
    };
    for (const e of epics) {
      const kids = dated.filter((t) => t.epicId === e.id);
      const ds = [parseDate(e.startDate), ...kids.map((k) => parseDate(k.startDate) ?? parseDate(k.dueDate))].filter(Boolean) as Date[];
      const de = [parseDate(e.targetDate), ...kids.map((k) => parseDate(k.dueDate) ?? parseDate(k.startDate))].filter(Boolean) as Date[];
      if (!kids.length && !e.startDate && !e.targetDate) continue;
      rows.push({ id: e.id, label: e.title, sub: `${e.progress.done}/${e.progress.total}`, indent: false, start: ds.length ? new Date(Math.min(...ds.map(Number))) : null, end: de.length ? new Date(Math.max(...de.map(Number))) : null, color: epicStatusMeta(e.status).color, progress: e.progress.total ? e.progress.done / e.progress.total : 0, to: `/p/${project.key}/epics/${e.id}`, kind: "epic" });
      kids.forEach((k) => rows.push(ticketRow(k)));
    }
    const loose = dated.filter((t) => !t.epicId || !epics.some((e) => e.id === t.epicId));
    if (loose.length) { rows.push({ id: "__none", label: "No epic", indent: false, start: null, end: null, color: "#9ca3af", to: "", kind: "epic" }); loose.forEach((t) => rows.push(ticketRow(t))); }
    const all = [...rows.flatMap((r) => [r.start, r.end]), ...milestones.flatMap((m) => [parseDate(m.startDate), parseDate(m.endDate)]), new Date()].filter(Boolean) as Date[];
    const min = new Date(Math.min(...all.map(Number))), max = new Date(Math.max(...all.map(Number)));
    return { rows, from: addDays(min, -7), to: addDays(max, 21) };
  }, [tickets, epics, milestones, status, project.key]);

  if (!rows.length && !milestones.length) return <EmptyState title="Nothing to plot yet" hint="Give tickets a start or due date (or epics a start/target date) and they appear here." />;

  const days = diffDays(from, to);
  const x = (d: Date) => diffDays(from, d) * dayW;
  const todayX = x(new Date());
  const months: { label: string; left: number; width: number }[] = [];
  for (let d = new Date(from.getFullYear(), from.getMonth(), 1); d <= to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    months.push({ label: d.toLocaleString(undefined, { month: "short", year: "numeric" }), left: Math.max(0, x(d)), width: (Math.min(diffDays(from, next), days) - Math.max(0, diffDays(from, d))) * dayW });
  }
  const width = days * dayW;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-outline px-4 py-1.5 text-xs">
        {(Object.keys(ZOOMS) as (keyof typeof ZOOMS)[]).map((z) => <button key={z} onClick={() => setZoom(z)} className={`rounded-sm px-2 py-1 capitalize ${zoom === z ? "bg-paper-grid text-ink" : "text-ink-muted hover:text-ink"}`}>{z}</button>)}
        <button className="ml-2 rounded-sm px-2 py-1 text-ink-muted hover:text-ink" onClick={() => scroller.current?.scrollTo({ left: Math.max(0, todayX - 200), behavior: "smooth" })}>Today</button>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
        <div style={{ width: width + LABEL_W }} className="relative">
          {/* header */}
          <div className="sticky top-0 z-20 flex h-14 border-b border-outline bg-paper">
            <div className="sticky left-0 z-30 shrink-0 border-r border-outline bg-paper" style={{ width: LABEL_W }} />
            <div className="relative" style={{ width }}>
              {months.map((m) => <div key={m.label} className="absolute top-0 h-7 truncate border-l border-outline px-2 text-xs leading-7 text-ink-muted" style={{ left: m.left, width: m.width }}>{m.label}</div>)}
              {milestones.map((m) => { const s = parseDate(m.startDate)!, e = parseDate(m.endDate)!; return (
                <button key={m.id} onClick={() => nav(`/p/${project.key}/milestones/${m.id}`)} title={`${m.name}: ${formatDate(m.startDate)} – ${formatDate(m.endDate)}`}
                  className={`absolute top-7 h-6 truncate rounded-sm px-1.5 text-left text-[11px] leading-6 ${m.state === "active" ? "bg-ion-deep/25 text-ink" : "bg-paper-grid text-ink-muted"}`} style={{ left: x(s), width: Math.max(dayW, (diffDays(s, e) + 1) * dayW) }}>{m.name}</button>
              ); })}
            </div>
          </div>
          {/* rows */}
          <div className="relative">
            <div className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-pin" style={{ left: LABEL_W + todayX }} title={`Today ${toIsoDate(new Date())}`} />
            {rows.map((r) => (
              <div key={r.kind + r.id} className="flex border-b border-outline/50 hover:bg-stone/60" style={{ height: ROW }}>
                <button onClick={() => r.to && nav(r.to)} className={`sticky left-0 z-10 flex shrink-0 items-center gap-1.5 truncate border-r border-outline bg-paper px-3 text-left text-sm ${r.indent ? "pl-8" : "font-medium"}`} style={{ width: LABEL_W }}>
                  {!r.indent ? <Layers className="size-3.5 shrink-0 text-ion-deep" /> : null}
                  {r.sub ? <span className="shrink-0 font-mono text-xs text-ink-muted">{r.sub}</span> : null}<span className="truncate">{r.label}</span>
                </button>
                <div className="relative" style={{ width }}>
                  {r.start && r.end ? (
                    <button onClick={() => nav(r.to)} title={`${r.label}: ${formatDate(toIsoDate(r.start))} – ${formatDate(toIsoDate(r.end))}`}
                      className="absolute top-1.5 h-5 overflow-hidden rounded-sm text-left text-[11px] leading-5 text-white" style={{ left: x(r.start), width: Math.max(dayW, (diffDays(r.start, r.end) + 1) * dayW), background: r.color, opacity: r.kind === "epic" ? 0.55 : 0.9 }}>
                      {r.progress != null ? <span className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${r.progress * 100}%` }} /> : null}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
