import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { CheckCircle2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from "@twodb/blocks";
import { useQuery } from "@tanstack/react-query";
import { TicketList } from "../tickets/TicketList";
import { CreateTicketDialog } from "../tickets/CreateTicketDialog";
import { EmptyState, ProgressBar, Spinner } from "../../components/Visuals";
import { selectCls } from "../projects/CreateProjectDialog";
import { del, get, patch, post, qs } from "../../lib/api";
import { useApiMutation, useMilestones } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import { formatDate } from "../../lib/format";
import type { Ticket } from "../../lib/types";

export function MilestoneDetailPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { project } = useProjectCtx();
  const { data: milestones, isLoading } = useMilestones(project.key);
  const m = milestones?.find((x) => x.id === id);
  const { data: tickets } = useQuery({ queryKey: ["tp", "ms-tickets", project.key, id], queryFn: () => get<{ items: Ticket[] }>(`/projects/${project.key}/tickets${qs({ milestoneId: id, parentId: "none", sort: "position" })}`) });
  const [adding, setAdding] = useState(false), [completing, setCompleting] = useState(false), [moveTo, setMoveTo] = useState("");
  const upd = useApiMutation((b: Record<string, unknown>) => patch(`/projects/${project.key}/milestones/${id}`, b));
  const complete = useApiMutation((b: { reopen?: boolean; moveOpenTo?: string | null }) => post(`/projects/${project.key}/milestones/${id}/complete`, b), { onSuccess: () => setCompleting(false) });
  const remove = useApiMutation(() => del(`/projects/${project.key}/milestones/${id}`), { onSuccess: () => nav("../milestones") });
  if (isLoading) return <Spinner />;
  if (!m) return <EmptyState title="Milestone not found" action={<Link className="text-ion-deep underline" to="../milestones">Back to milestones</Link>} />;
  const open = m.progress.total - m.progress.done - m.progress.canceled;
  const others = (milestones ?? []).filter((x) => x.id !== id && x.state !== "completed");
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
      <div className="text-sm text-ink-muted"><Link to="../milestones" className="hover:underline">Milestones</Link> / {m.name}</div>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <input key={m.name} defaultValue={m.name} onBlur={(e) => e.target.value.trim() && e.target.value !== m.name && upd.mutate({ name: e.target.value.trim() })} className="w-full rounded-sm bg-transparent px-1 text-2xl font-semibold tracking-tight outline-none hover:bg-stone focus:bg-stone" aria-label="Name" />
          <input key={m.goal} defaultValue={m.goal} placeholder="Add a goal…" onBlur={(e) => e.target.value !== m.goal && upd.mutate({ goal: e.target.value })} className="mt-1 w-full rounded-sm bg-transparent px-1 text-sm text-ink-muted outline-none hover:bg-stone focus:bg-stone" aria-label="Goal" />
        </div>
        {m.completedAt ? <Button variant="secondary" size="sm" onClick={() => complete.mutate({ reopen: true })}><RotateCcw />Reopen</Button> : <Button size="sm" onClick={() => setCompleting(true)}><CheckCircle2 />Complete</Button>}
        <Button size="sm" variant="ghost" className="text-destructive" aria-label="Delete milestone" onClick={() => confirm("Delete this milestone? Its tickets are kept (just unlinked).") && remove.mutate()}><Trash2 /></Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 text-ink-muted">Start<Input type="date" className="h-8 w-40" value={m.startDate} onChange={(e) => e.target.value && upd.mutate({ startDate: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-ink-muted">End<Input type="date" className="h-8 w-40" min={m.startDate} value={m.endDate} onChange={(e) => e.target.value && upd.mutate({ endDate: e.target.value })} /></label>
        <span className="text-ink-muted">{formatDate(m.startDate, true)} → {formatDate(m.endDate, true)}{m.completedAt ? ` · completed ${formatDate(m.completedAt.slice(0, 10), true)}` : ""}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Done", m.progress.done], ["In progress", m.progress.inProgress], ["Open", open - m.progress.inProgress]].map(([label, n]) => <div key={label as string} className="rounded-md border border-outline p-3"><div className="text-2xl font-semibold">{n}</div><div className="text-xs text-ink-muted">{label}</div></div>)}
      </div>
      <div className="flex flex-col gap-1.5"><ProgressBar done={m.progress.done} inProgress={m.progress.inProgress} total={m.progress.total} />{project.pointsEstimateEnabled ? <div className="text-xs text-ink-muted">{m.progress.donePoints} of {m.progress.points} points done</div> : null}</div>
      <div className="flex items-center"><h2 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Tickets</h2><Button size="sm" variant="ghost" className="ml-auto" onClick={() => setAdding(true)}><Plus />Add ticket</Button></div>
      {tickets ? <TicketList tickets={tickets.items} empty="No tickets in this milestone yet" /> : <Spinner />}
      <CreateTicketDialog open={adding} onOpenChange={setAdding} defaults={{ milestoneId: id }} />
      <Dialog open={completing} onOpenChange={setCompleting}>
        <DialogContent><DialogHeader><DialogTitle>Complete “{m.name}”</DialogTitle></DialogHeader>
          <p className="text-sm text-ink-muted">{open} ticket(s) are not finished. What should happen to them?</p>
          <select className={selectCls} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}><option value="">Keep them in this milestone</option><option value="__none">Move to no milestone (backlog)</option>{others.map((o) => <option key={o.id} value={o.id}>Move to {o.name}</option>)}</select>
          <DialogFooter><Button variant="ghost" onClick={() => setCompleting(false)}>Cancel</Button><Button onClick={() => complete.mutate(moveTo === "" ? {} : { moveOpenTo: moveTo === "__none" ? null : moveTo })}>Complete milestone</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
