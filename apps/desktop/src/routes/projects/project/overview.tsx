import { useMemo } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Flag, FolderKanban, ListTodo, Loader2, Zap } from "lucide-react";
import type { ProjectDetail, TicketSummary } from "../use-projects";
import { useTickets } from "../use-projects";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityIcon, TypeIcon } from "./board";

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Zap; label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
          <Icon size={14} /> {label}
        </div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function ago(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

/** Overview tab: project landing page — stats, progress by status, active sprint, milestones, recent tickets. */
export function Overview({ detail, subprojectId }: { detail: ProjectDetail; subprojectId?: string }) {
  const navigate = useNavigate();
  const base = `/apps/projects/${detail.project.id}`;
  const tickets = useTickets(detail.project.id, subprojectId ? { subprojectId } : {});

  const data = useMemo(() => {
    const all = tickets.data ?? [];
    const byCat = (t: TicketSummary) => t.status?.category ?? detail.statuses.find((s) => s.id === t.statusId)?.category ?? "todo";
    const counts = { backlog: 0, todo: 0, in_progress: 0, done: 0, canceled: 0 };
    const perStatus = new Map<string, number>();
    for (const t of all) {
      counts[byCat(t)] += 1;
      perStatus.set(t.statusId, (perStatus.get(t.statusId) ?? 0) + 1);
    }
    const active = all.filter((t) => byCat(t) !== "done" && byCat(t) !== "canceled");
    const total = all.length - counts.canceled;
    const recent = [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
    return { all, counts, total, perStatus, openCount: active.length, recent };
  }, [tickets.data, detail.statuses]);

  const activeSprint = detail.sprints.find((s) => s.status === "active");
  const sprintTickets = activeSprint ? data.all.filter((t) => t.sprintId === activeSprint.id) : [];
  const doneIds = new Set(detail.statuses.filter((s) => s.category === "done").map((s) => s.id));
  const sprintDone = sprintTickets.filter((t) => doneIds.has(t.statusId)).length;
  const pct = data.total > 0 ? Math.round((data.counts.done / data.total) * 100) : 0;
  const openMilestones = detail.milestones.filter((m) => m.status === "open");
  const rootStatuses = detail.statuses.filter((s) => s.subprojectId === null);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 py-8">
      {detail.project.description && <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">{detail.project.description}</p>}

      {tickets.isPending ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon={ListTodo} label="Open tickets" value={data.openCount} hint={`${data.total} total`} />
          <Stat icon={Loader2} label="In progress" value={data.counts.in_progress} />
          <Stat icon={CheckCircle2} label="Completed" value={data.counts.done} hint={`${pct}% of all tickets`} />
          <Stat icon={Zap} label="Active sprint" value={activeSprint ? `${sprintDone}/${sprintTickets.length}` : "—"} hint={activeSprint?.name ?? "No active sprint"} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Progress</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pt-2">
              <div className="flex flex-col gap-2">
                <Progress value={pct} className="h-2" />
                <span className="text-muted-foreground text-xs">
                  {data.counts.done} of {data.total} tickets done
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {rootStatuses.map((s) => {
                  const n = data.perStatus.get(s.id) ?? 0;
                  return (
                    <div key={s.id} className="flex items-center gap-3 text-sm">
                      <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="w-36 truncate">{s.name}</span>
                      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                        <div className="h-full rounded-full" style={{ width: `${data.total ? (n / data.total) * 100 : 0}%`, backgroundColor: s.color }} />
                      </div>
                      <span className="text-muted-foreground w-8 text-right text-xs tabular-nums">{n}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recently updated</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col px-2 pb-2">
              {data.recent.length === 0 && <p className="text-muted-foreground px-3 py-6 text-center text-xs">No tickets yet.</p>}
              {data.recent.map((t) => (
                <button
                  key={t.id}
                  className="hover:bg-accent/50 flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors"
                  onClick={() => navigate(`${base}/ticket/${t.id}`)}
                >
                  <TypeIcon type={t.type} />
                  <span className="text-muted-foreground w-20 shrink-0 font-mono text-xs">{t.identifier}</span>
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <PriorityIcon priority={t.priority} />
                  {t.status && (
                    <Badge variant="outline" className="gap-1.5 text-[10px] font-normal">
                      <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: t.status.color }} />
                      {t.status.name}
                    </Badge>
                  )}
                  <span className="text-muted-foreground w-14 shrink-0 text-right text-xs">{ago(t.updatedAt)}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                Active sprint
                <button className="text-muted-foreground hover:text-foreground text-xs font-normal" onClick={() => navigate(`${base}/sprints`)}>
                  All sprints
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-2">
              {activeSprint ? (
                <>
                  <div className="text-sm font-medium">{activeSprint.name}</div>
                  {(activeSprint.startDate || activeSprint.endDate) && (
                    <div className="text-muted-foreground text-xs">
                      {activeSprint.startDate ?? "?"} → {activeSprint.endDate ?? "?"}
                    </div>
                  )}
                  <Progress value={sprintTickets.length ? (sprintDone / sprintTickets.length) * 100 : 0} className="h-1.5" />
                  <span className="text-muted-foreground text-xs">
                    {sprintDone}/{sprintTickets.length} tickets done
                  </span>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">No sprint is running.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                Milestones
                <button className="text-muted-foreground hover:text-foreground text-xs font-normal" onClick={() => navigate(`${base}/milestones`)}>
                  View all
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-2">
              {openMilestones.length === 0 && <p className="text-muted-foreground text-xs">No open milestones.</p>}
              {openMilestones.slice(0, 5).map((m) => {
                const mt = data.all.filter((t) => t.milestoneId === m.id);
                const md = mt.filter((t) => doneIds.has(t.statusId)).length;
                return (
                  <div key={m.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <Flag size={12} className="shrink-0 text-amber-500" />
                      <span className="min-w-0 flex-1 truncate">{m.name}</span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {md}/{mt.length}
                      </span>
                    </div>
                    <Progress value={mt.length ? (md / mt.length) * 100 : 0} className="h-1" />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className={cn("text-muted-foreground flex flex-col gap-2 pt-2 text-xs")}>
              <div className="flex items-center gap-2">
                <FolderKanban size={12} /> {detail.subprojects.length} subprojects
              </div>
              <div>{detail.members.length} members</div>
              {detail.project.lastSyncAt && <div>Last synced {ago(detail.project.lastSyncAt)}</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
