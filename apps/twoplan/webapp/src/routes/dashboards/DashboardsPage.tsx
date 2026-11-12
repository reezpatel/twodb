import { Link, useNavigate, useParams } from "react-router";
import { LayoutDashboard, Plus, Trash2, X } from "lucide-react";
import { Button } from "@twodb/blocks";
import { EmptyState, ProgressBar, Spinner } from "../../components/Visuals";
import { del, patch, post } from "../../lib/api";
import { useApiMutation, useDashboards, useStats, useMilestones } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import { useMembers } from "../../lib/members";
import { PRIORITIES } from "../../lib/meta";
import type { Dashboard, Widget } from "../../lib/types";

const WIDGETS: { type: string; title: string }[] = [
  { type: "by_status", title: "Tickets by status" }, { type: "by_priority", title: "Tickets by priority" }, { type: "by_assignee", title: "Tickets by assignee" },
  { type: "by_type", title: "Tickets by type" }, { type: "by_epic", title: "Tickets by epic" }, { type: "created_vs_completed", title: "Created vs completed (28d)" },
  { type: "overdue", title: "Overdue tickets" }, { type: "milestone_progress", title: "Milestone progress" },
];

function BarList({ rows, total }: { rows: { label: string; count: number; color?: string }[]; total: number }) {
  if (!rows.length) return <div className="text-sm text-ink-muted">No data</div>;
  return <div className="flex flex-col gap-2">{rows.map((r) => <div key={r.label} className="flex items-center gap-2 text-sm"><span className="w-32 shrink-0 truncate">{r.label}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-grid"><div className="h-full rounded-full" style={{ width: `${total ? (r.count / total) * 100 : 0}%`, background: r.color ?? "var(--ion-deep)" }} /></div><span className="w-8 text-right text-xs text-ink-muted">{r.count}</span></div>)}</div>;
}

function WidgetBody({ w }: { w: Widget }) {
  const { project, config, label } = useProjectCtx();
  const { nameOf } = useMembers();
  const { data } = useStats(project.key);
  const { data: ms = [] } = useMilestones(project.key);
  if (!data) return <Spinner />;
  const total = (rows: { count: number }[]) => rows.reduce((a, r) => a + r.count, 0);
  const rows = (list: { key: string | null; count: number }[], name: (k: string | null) => { label: string; color?: string }) => list.map((r) => ({ ...name(r.key), count: r.count })).sort((a, b) => b.count - a.count);
  void label;
  switch (w.type) {
    case "by_status": { const r = rows(data.byStatus, (k) => { const s = config.statuses.find((x) => x.id === k); return { label: s?.name ?? "?", color: s?.color }; }); return <BarList rows={r} total={total(r)} />; }
    case "by_priority": { const r = rows(data.byPriority, (k) => { const p = PRIORITIES.find((x) => x.id === k); return { label: p?.label ?? "No priority", color: p?.color }; }); return <BarList rows={r} total={total(r)} />; }
    case "by_assignee": { const r = rows(data.byAssignee, (k) => ({ label: nameOf(k) })); return <BarList rows={r} total={total(r)} />; }
    case "by_type": { const r = rows(data.byType, (k) => { const t = config.ticketTypes.find((x) => x.id === k); return { label: t?.name ?? "No type", color: t?.color }; }); return <BarList rows={r} total={total(r)} />; }
    case "by_epic": { const r = rows(data.byEpic, (k) => ({ label: k ? k.slice(-6) : "No epic" })); return <BarList rows={r} total={total(r)} />; }
    case "created_vs_completed": return <div className="flex gap-8"><div><div className="text-3xl font-semibold">{data.createdLast28d}</div><div className="text-xs text-ink-muted">created</div></div><div><div className="text-3xl font-semibold text-success">{data.completedLast28d}</div><div className="text-xs text-ink-muted">completed</div></div></div>;
    case "overdue": return <div><div className={`text-3xl font-semibold ${data.overdue ? "text-destructive" : ""}`}>{data.overdue}</div><div className="text-xs text-ink-muted">open tickets past their due date</div></div>;
    case "milestone_progress": return <div className="flex flex-col gap-3">{ms.filter((m) => m.state !== "completed").map((m) => <div key={m.id} className="flex flex-col gap-1"><div className="flex justify-between text-sm"><span>{m.name}</span><span className="text-xs text-ink-muted">{m.progress.done}/{m.progress.total}</span></div><ProgressBar done={m.progress.done} inProgress={m.progress.inProgress} total={m.progress.total} /></div>)}{!ms.some((m) => m.state !== "completed") ? <div className="text-sm text-ink-muted">No active milestones</div> : null}</div>;
    default: return null;
  }
}

function DashboardView({ d }: { d: Dashboard }) {
  const { project } = useProjectCtx();
  const nav = useNavigate();
  const save = useApiMutation((b: Record<string, unknown>) => patch(`/projects/${project.key}/dashboards/${d.id}`, b));
  const remove = useApiMutation(() => del(`/projects/${project.key}/dashboards/${d.id}`), { onSuccess: () => nav("../dashboards") });
  const add = (type: string) => save.mutate({ widgets: [...d.widgets, { id: crypto.randomUUID(), type, title: WIDGETS.find((w) => w.type === type)?.title }] });
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <input key={d.name} defaultValue={d.name} onBlur={(e) => e.target.value.trim() && e.target.value !== d.name && save.mutate({ name: e.target.value.trim() })} className="bg-transparent text-xl font-semibold outline-none" aria-label="Dashboard name" />
        <select value="" onChange={(e) => e.target.value && add(e.target.value)} className="ml-auto h-8 rounded-md border border-outline bg-paper px-2 text-sm" aria-label="Add widget"><option value="">+ Add widget</option>{WIDGETS.map((w) => <option key={w.type} value={w.type}>{w.title}</option>)}</select>
        <Button size="sm" variant="ghost" className="text-destructive" aria-label="Delete dashboard" onClick={() => confirm("Delete this dashboard?") && remove.mutate()}><Trash2 /></Button>
      </div>
      {!d.widgets.length ? <EmptyState title="Empty dashboard" hint="Add widgets from the menu above." /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{d.widgets.map((w) => (
          <div key={w.id} className="rounded-md border border-outline bg-card p-4"><div className="mb-3 flex items-center text-sm font-medium">{w.title ?? w.type}<button aria-label="Remove widget" className="ml-auto text-ink-muted hover:text-destructive" onClick={() => save.mutate({ widgets: d.widgets.filter((x) => x.id !== w.id) })}><X className="size-4" /></button></div><WidgetBody w={w} /></div>
        ))}</div>
      )}
    </div>
  );
}

export function DashboardsPage() {
  const { project } = useProjectCtx();
  const { id } = useParams();
  const nav = useNavigate();
  const { data, isLoading } = useDashboards(project.key);
  const create = useApiMutation(() => post<Dashboard>(`/projects/${project.key}/dashboards`, { name: "Overview", widgets: ["by_status", "by_priority", "created_vs_completed", "milestone_progress"].map((type) => ({ id: crypto.randomUUID(), type, title: WIDGETS.find((w) => w.type === type)!.title })) }), { onSuccess: (d) => nav(d.id) });
  if (isLoading) return <Spinner />;
  const current = data?.find((d) => d.id === id) ?? (!id ? data?.[0] : undefined);
  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-outline p-3"><Button size="sm" variant="secondary" onClick={() => create.mutate()}><Plus />New dashboard</Button>
        {(data ?? []).map((d) => <Link key={d.id} to={d.id} className={`flex items-center gap-2 truncate rounded-sm px-2 py-1.5 text-sm ${d.id === current?.id ? "bg-stone" : "hover:bg-stone"}`}><LayoutDashboard className="size-4 shrink-0 text-ink-muted" />{d.name}</Link>)}</aside>
      <div className="min-w-0 flex-1 overflow-y-auto">{current ? <DashboardView key={current.id} d={current} /> : <EmptyState title="No dashboards yet" hint="Dashboards show live charts of this project's tickets." action={<Button onClick={() => create.mutate()}>Create a dashboard</Button>} />}</div>
    </div>
  );
}
