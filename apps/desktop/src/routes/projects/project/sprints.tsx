import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Calendar, Check, CircleCheck, Gauge, LayoutGrid, List, ListChecks, Play, Plus, Target, Zap } from "lucide-react";
import type { ProjectDetail, Sprint, TicketSummary } from "../use-projects";
import { useProjectMutation, useTickets, useVelocity } from "../use-projects";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIcon, TicketCardBody } from "./board";
import { NewSprintDialog, NewTicketDialog } from "./dialogs";
import { TicketRow, shortDate } from "./ticket-row";

const STATUS_STYLE: Record<Sprint["status"], string> = {
  active: "text-amber-500 border-amber-500/40 bg-amber-500/10",
  planned: "text-muted-foreground bg-muted/50",
  closed: "text-success border-success/40 bg-success/10",
};

function daysLeft(end: string | null) {
  if (!end) return null;
  const d = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
  return d >= 0 ? `${d} day${d === 1 ? "" : "s"} left` : `${-d} day${d === -1 ? "" : "s"} overdue`;
}

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof Zap; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-5">
      <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
        <Icon size={14} /> {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-muted-foreground -mt-1 text-xs">{sub}</div>}
    </div>
  );
}

function SprintRail({
  items,
  selectedId,
  onSelect,
  onNew,
}: {
  items: { sprint: Sprint; plannedPoints: number; completedPoints: number }[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-2 border-r p-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold">Sprints</span>
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={onNew}>
          <Plus size={13} /> New
        </Button>
      </div>
      {items.map(({ sprint, plannedPoints, completedPoints }) => {
        const pct = plannedPoints ? (completedPoints / plannedPoints) * 100 : 0;
        return (
          <button
            key={sprint.id}
            onClick={() => onSelect(sprint.id)}
            className={cn(
              "flex flex-col gap-2.5 rounded-xl border p-3.5 text-left transition-colors",
              selectedId === sprint.id ? "bg-accent/60 border-foreground/20" : "hover:bg-accent/30 border-transparent",
            )}
          >
            <div className="flex items-center gap-2">
              <Zap size={13} className={sprint.status === "active" ? "text-amber-500" : "text-muted-foreground"} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{sprint.name}</span>
              <span className={cn("rounded-full border px-1.5 py-px text-[10px] capitalize", STATUS_STYLE[sprint.status])}>{sprint.status}</span>
            </div>
            <Progress value={pct} className="h-1" />
            <div className="text-muted-foreground flex justify-between text-[11px]">
              <span>{sprint.startDate ? `${shortDate(sprint.startDate)} → ${sprint.endDate ? shortDate(sprint.endDate) : "?"}` : "No dates"}</span>
              <span className="tabular-nums">
                {completedPoints}/{plannedPoints} pts
              </span>
            </div>
          </button>
        );
      })}
    </aside>
  );
}

function SprintDetail({
  sprint,
  plannedPoints,
  completedPoints,
  detail,
  subprojectId,
  onPatch,
}: {
  sprint: Sprint;
  plannedPoints: number;
  completedPoints: number;
  detail: ProjectDetail;
  subprojectId?: string;
  onPatch: (status: string) => void;
}) {
  const navigate = useNavigate();
  const [view, setView] = useState<"cards" | "list">("cards");
  const [adding, setAdding] = useState(false);
  const tickets = useTickets(detail.project.id, { sprintId: sprint.id, ...(subprojectId ? { subprojectId } : {}) });
  const list = useMemo(() => (tickets.data ?? []).filter((t) => !t.inBacklog), [tickets.data]);

  const statuses = useMemo(() => detail.statuses.filter((s) => s.subprojectId === null).sort((a, b) => a.position - b.position), [detail.statuses]);
  const groups = useMemo(() => {
    const map = new Map<string, TicketSummary[]>();
    for (const t of list) map.set(t.statusId, [...(map.get(t.statusId) ?? []), t]);
    return statuses.map((s) => ({ status: s, tickets: map.get(s.id) ?? [] })).filter((g) => g.tickets.length > 0);
  }, [list, statuses]);

  const doneIds = new Set(detail.statuses.filter((s) => s.category === "done").map((s) => s.id));
  const done = list.filter((t) => doneIds.has(t.statusId)).length;
  const inProgress = list.filter((t) => t.status?.category === "in_progress").length;
  const pct = plannedPoints > 0 ? (completedPoints / plannedPoints) * 100 : list.length ? (done / list.length) * 100 : 0;
  const remaining = sprint.status === "active" ? daysLeft(sprint.endDate) : null;

  const workload = useMemo(() => {
    const m = new Map<string, { name: string; image: string | null; total: number; done: number }>();
    for (const t of list) {
      if (!t.assignee) continue;
      const cur = m.get(t.assignee.id) ?? { name: t.assignee.name, image: t.assignee.image, total: 0, done: 0 };
      cur.total += 1;
      if (doneIds.has(t.statusId)) cur.done += 1;
      m.set(t.assignee.id, cur);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const open = (id: string) => navigate(`/apps/projects/${detail.project.id}/ticket/${id}`);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 overflow-y-auto px-10 py-8">
      <header className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h2 className="truncate text-2xl font-semibold tracking-tight">{sprint.name}</h2>
            <Badge variant="outline" className={cn("capitalize", STATUS_STYLE[sprint.status])}>
              {sprint.status}
            </Badge>
          </div>
          <div className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
            <Calendar size={14} />
            {sprint.startDate ? shortDate(sprint.startDate) : "No start"} → {sprint.endDate ? shortDate(sprint.endDate) : "No end"}
            {remaining && <span className="text-foreground/80">· {remaining}</span>}
          </div>
        </div>
        <Button variant="outline" className="gap-1.5" onClick={() => setAdding(true)}>
          <Plus size={14} /> Add ticket
        </Button>
        {sprint.status === "planned" && (
          <Button className="gap-1.5" onClick={() => onPatch("active")}>
            <Play size={13} /> Start sprint
          </Button>
        )}
        {sprint.status === "active" && (
          <Button className="gap-1.5" onClick={() => onPatch("closed")}>
            <Check size={14} /> Complete sprint
          </Button>
        )}
      </header>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Gauge} label="Progress" value={`${Math.round(pct)}%`} sub={`${completedPoints} of ${plannedPoints} points`} />
        <StatCard icon={CircleCheck} label="Completed" value={`${done}/${list.length}`} sub="tickets done" />
        <StatCard icon={ListChecks} label="In progress" value={inProgress} sub="tickets being worked on" />
        <StatCard icon={Target} label="Remaining" value={`${Math.max(0, plannedPoints - completedPoints)}`} sub="story points" />
      </div>
      <Progress value={pct} className="-mt-3 h-2" />

      {workload.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground text-xs font-medium">Workload</span>
          {workload.map((w) => (
            <span key={w.name} className="bg-card flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs">
              <Avatar className="size-5">
                {w.image && <AvatarImage src={w.image} />}
                <AvatarFallback className="text-[8px]">{w.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              {w.name}
              <span className="text-muted-foreground tabular-nums">
                {w.done}/{w.total}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Sprint tickets</h3>
          <div className="bg-muted flex rounded-lg p-0.5">
            {([["cards", LayoutGrid], ["list", List]] as const).map(([v, Icon]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-label={`${v} view`}
                className={cn("flex size-8 items-center justify-center rounded-md", view === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
        {tickets.isPending && <Skeleton className="h-40 rounded-xl" />}
        {!tickets.isPending && groups.length === 0 && (
          <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-sm">
            <Zap size={22} />
            No tickets in this sprint yet.
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              Add the first ticket
            </Button>
          </div>
        )}
        {groups.map(({ status, tickets: ts }) => (
          <section key={status.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-sm font-medium">
              <StatusIcon category={status.category} color={status.color} />
              {status.name}
              <span className="text-muted-foreground text-xs tabular-nums">{ts.length}</span>
            </div>
            {view === "cards" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {ts.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => open(t.id)}
                    className="bg-card hover:border-foreground/20 cursor-pointer rounded-xl border p-4 shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
                  >
                    <TicketCardBody ticket={t} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-card divide-border/60 divide-y overflow-hidden rounded-xl border">
                {ts.map((t) => (
                  <TicketRow key={t.id} ticket={t} onOpen={() => open(t.id)} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
      {adding && <NewTicketDialog open onClose={() => setAdding(false)} detail={detail} subprojectId={subprojectId} sprintId={sprint.id} sprintName={sprint.name} backlog={false} />}
    </div>
  );
}

/** Sprints tab: sprint rail on the left, selected sprint dashboard + tickets (grouped by status) on the right. */
export function Sprints({ detail, subprojectId }: { detail: ProjectDetail; subprojectId?: string }) {
  const velocity = useVelocity(detail.project.id);
  const [selected, setSelected] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const patch = useProjectMutation(
    ({ id, ...body }: { id: string; status?: string }) => api(`/api/projects/sprints/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    [detail.project.id],
  );

  const order = { active: 0, planned: 1, closed: 2 } as const;
  const items = useMemo(() => [...(velocity.data ?? [])].sort((a, b) => order[a.sprint.status] - order[b.sprint.status]), [velocity.data]);
  const current = items.find((i) => i.sprint.id === selected) ?? items[0];

  if (velocity.isPending) return <Skeleton className="m-8 h-64 rounded-xl" />;

  return (
    <div className="flex h-full">
      <SprintRail items={items} selectedId={current?.sprint.id} onSelect={setSelected} onNew={() => setCreating(true)} />
      {current ? (
        <SprintDetail
          key={current.sprint.id}
          sprint={current.sprint}
          plannedPoints={current.plannedPoints}
          completedPoints={current.completedPoints}
          detail={detail}
          subprojectId={subprojectId}
          onPatch={(status) => patch.mutate({ id: current.sprint.id, status })}
        />
      ) : (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 text-sm">
          <Zap size={26} />
          No sprints yet.
          <Button onClick={() => setCreating(true)}>
            <Plus size={14} /> Create your first sprint
          </Button>
        </div>
      )}
      <NewSprintDialog open={creating} onClose={() => setCreating(false)} projectId={detail.project.id} />
    </div>
  );
}
