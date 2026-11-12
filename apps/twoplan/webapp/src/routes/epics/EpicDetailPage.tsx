import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@twodb/blocks";
import { RichTextEditor } from "@twodb/editor";
import { useQuery } from "@tanstack/react-query";
import { EpicStatusBadge } from "./EpicsPage";
import { TicketList } from "../tickets/TicketList";
import { CreateTicketDialog } from "../tickets/CreateTicketDialog";
import { AssigneePicker, DateField, PriorityPicker } from "../../components/PropertyPickers";
import { Picker, triggerCls } from "../../components/Picker";
import { LabelPill, ProgressBar, Spinner, EmptyState } from "../../components/Visuals";
import { del, get, patch, put, qs } from "../../lib/api";
import { useApiMutation, useEpics } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import { EPIC_STATUSES } from "../../lib/meta";
import type { Epic, EpicStatus, Ticket } from "../../lib/types";

export function EpicDetailPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { project, config, label } = useProjectCtx();
  const { data: epics, isLoading } = useEpics(project.key);
  const epic = epics?.find((e) => e.id === id);
  const { data: tickets } = useQuery({ queryKey: ["tp", "epic-tickets", project.key, id], queryFn: () => get<{ items: Ticket[] }>(`/projects/${project.key}/tickets${qs({ epicId: id, parentId: "none", sort: "position" })}`) });
  const [adding, setAdding] = useState(false);
  const upd = useApiMutation((b: Partial<Epic> & Record<string, unknown>) => patch(`/projects/${project.key}/epics/${id}`, b));
  const setLabels = useApiMutation((ids: string[]) => put(`/projects/${project.key}/epics/${id}/labels`, { labelIds: ids }));
  const remove = useApiMutation(() => del(`/projects/${project.key}/epics/${id}`), { onSuccess: () => nav("../epics") });
  if (isLoading) return <Spinner />;
  if (!epic) return <EmptyState title="Epic not found" action={<Link className="text-ion-deep underline" to="../epics">Back to epics</Link>} />;
  const p = epic.progress;
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-6">
        <div className="text-sm text-ink-muted"><Link to="../epics" className="hover:underline">Epics</Link> / {epic.title}</div>
        <input key={epic.title} defaultValue={epic.title} onBlur={(e) => e.target.value.trim() && e.target.value !== epic.title && upd.mutate({ title: e.target.value.trim() })} className="w-full rounded-sm bg-transparent px-1 text-2xl font-semibold tracking-tight outline-none hover:bg-stone focus:bg-stone" aria-label="Epic title" />
        <RichTextEditor value={epic.description} bare placeholder="Describe the epic…" onBlur={(h) => h !== epic.description && upd.mutate({ description: h })} className="rounded-md border border-transparent hover:border-outline focus-within:border-outline" />
        <div className="flex flex-col gap-1.5"><div className="flex items-center justify-between text-sm"><span className="font-medium">Progress</span><span className="text-ink-muted">{p.done}/{p.total} tickets{project.pointsEstimateEnabled ? ` · ${p.donePoints}/${p.points} pts` : ""}</span></div><ProgressBar done={p.done} inProgress={p.inProgress} total={p.total} /></div>
        <div className="flex items-center"><h2 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Tickets</h2><Button size="sm" variant="ghost" className="ml-auto" onClick={() => setAdding(true)}><Plus />Add ticket</Button></div>
        {tickets ? <TicketList tickets={tickets.items} empty="No tickets in this epic yet" /> : <Spinner />}
      </div>
      <aside className="flex w-80 shrink-0 flex-col gap-2 border-l border-outline p-4 text-sm">
        <Row label="Status"><select value={epic.status} onChange={(e) => upd.mutate({ status: e.target.value as EpicStatus })} className="h-7 rounded-sm bg-transparent px-1 hover:bg-paper-grid">{EPIC_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select><EpicStatusBadge status={epic.status} /></Row>
        <Row label="Owner"><AssigneePicker value={epic.ownerUserId} onChange={(v) => upd.mutate({ ownerUserId: v })} /></Row>
        <Row label="Priority"><PriorityPicker value={epic.priority} onChange={(v) => upd.mutate({ priority: v })} /></Row>
        <Row label="Start"><DateField value={epic.startDate} onChange={(v) => upd.mutate({ startDate: v })} label="Set start" /></Row>
        <Row label="Target"><DateField value={epic.targetDate} onChange={(v) => upd.mutate({ targetDate: v })} label="Set target" /></Row>
        <Row label="Labels"><Picker multiple searchable value={epic.labelIds} onChange={(v) => setLabels.mutate(v)} options={config.labels.map((l) => ({ id: l.id, label: l.name, icon: <span className="size-2.5 rounded-full" style={{ background: l.color }} /> }))}
          trigger={<button type="button" className={triggerCls}>{epic.labelIds.length ? <span className="flex flex-wrap gap-1">{epic.labelIds.map((i) => { const l = label(i); return l ? <LabelPill key={i} name={l.name} color={l.color} /> : null; })}</span> : <span className="text-ink-muted">No labels</span>}</button>} /></Row>
        <div className="mt-4 border-t border-outline pt-3"><Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirm("Delete this epic? Its tickets are kept (just unlinked).") && remove.mutate()}><Trash2 />Delete epic</Button></div>
      </aside>
      <CreateTicketDialog open={adding} onOpenChange={setAdding} defaults={{ epicId: id }} />
    </div>
  );
}
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="flex min-h-8 items-center gap-2"><span className="w-20 shrink-0 text-xs text-ink-muted">{label}</span><div className="flex min-w-0 items-center gap-2">{children}</div></div>;
