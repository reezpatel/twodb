import { memo } from "react";
import { Link } from "react-router";
import { Checkbox } from "@twodb/blocks";
import { Layers, ListTree } from "lucide-react";
import { AssigneePicker, DateField, PriorityPicker, StatusPicker } from "../../components/PropertyPickers";
import { LabelPill, TypeIcon } from "../../components/Visuals";
import { useProjectCtx } from "../../lib/project-context";
import { formatDate, formatMinutes, today } from "../../lib/format";
import { isOpen } from "../../lib/meta";
import type { Epic, Ticket } from "../../lib/types";

interface Props {
  ticket: Ticket; selected: boolean; onSelect: (id: string, on: boolean) => void;
  onPatch: (id: string, body: Record<string, unknown>) => void; epic?: Epic;
}

/** Dense list row with inline-editable properties. */
export const TicketRow = memo(function TicketRow({ ticket: t, selected, onSelect, onPatch, epic }: Props) {
  const { project, status, type, label } = useProjectCtx();
  const st = status(t.statusId);
  const ty = type(t.typeId);
  const overdue = t.dueDate && t.dueDate < today() && isOpen(st?.category);
  return (
    <div className={`group flex h-10 items-center gap-1 border-b border-outline/60 px-3 text-sm hover:bg-stone ${selected ? "bg-stone" : ""}`}>
      <Checkbox checked={selected} onCheckedChange={(v) => onSelect(t.id, v === true)} aria-label={`Select ${t.identifier}`} className="mr-1" />
      <PriorityPicker compact value={t.priority} onChange={(v) => onPatch(t.id, { priority: v })} />
      <span className="w-20 shrink-0 font-mono text-xs text-ink-muted">{t.identifier}</span>
      <StatusPicker compact value={t.statusId} onChange={(v) => onPatch(t.id, { statusId: v })} />
      {ty ? <TypeIcon icon={ty.icon} color={ty.color} /> : null}
      <Link to={`/p/${project.key}/t/${t.identifier}`} className={`min-w-0 truncate px-1 font-medium hover:underline ${st?.category === "done" || st?.category === "canceled" ? "text-ink-muted line-through" : ""}`}>{t.title}</Link>
      {t.subtaskCount ? <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted" title="Sub-tasks"><ListTree className="size-3.5" />{t.subtaskDoneCount}/{t.subtaskCount}</span> : null}
      <span className="ml-1 hidden shrink-0 items-center gap-1 lg:flex">{t.labelIds.slice(0, 3).map((id) => { const l = label(id); return l ? <LabelPill key={id} name={l.name} color={l.color} /> : null; })}</span>
      <span className="flex-1" />
      {epic ? <Link to={`/p/${project.key}/epics/${epic.id}`} className="hidden max-w-36 shrink-0 items-center gap-1 truncate rounded-sm px-1.5 py-0.5 text-xs text-ink-muted hover:bg-paper-grid xl:inline-flex"><Layers className="size-3" />{epic.title}</Link> : null}
      {project.pointsEstimateEnabled && t.estimatePoints != null ? <span className="w-8 shrink-0 text-right text-xs text-ink-muted" title="Points">{t.estimatePoints}</span> : null}
      {project.timeEstimateEnabled && t.estimateMinutes ? <span className="w-12 shrink-0 text-right text-xs text-ink-muted">{formatMinutes(t.estimateMinutes)}</span> : null}
      <span className={overdue ? "text-destructive" : ""}><DateField compact value={t.dueDate} onChange={(v) => onPatch(t.id, { dueDate: v })} label="Due date" /></span>
      <AssigneePicker compact value={t.assigneeUserId} onChange={(v) => onPatch(t.id, { assigneeUserId: v })} />
    </div>
  );
});
