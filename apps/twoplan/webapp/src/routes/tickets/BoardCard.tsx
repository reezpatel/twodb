import { Link } from "react-router";
import { CalendarDays, Layers, ListTree } from "lucide-react";
import { Avatar, LabelPill, PriorityIcon, TypeIcon } from "../../components/Visuals";
import { useProjectCtx } from "../../lib/project-context";
import { useMembers } from "../../lib/members";
import { formatDate, today } from "../../lib/format";
import { isOpen } from "../../lib/meta";
import type { Ticket } from "../../lib/types";

export function BoardCard({ ticket: t, epicTitle, dragging }: { ticket: Ticket; epicTitle?: string; dragging?: boolean }) {
  const { project, type, label, status } = useProjectCtx();
  const { byId } = useMembers();
  const ty = type(t.typeId);
  const assignee = byId(t.assigneeUserId);
  const overdue = t.dueDate && t.dueDate < today() && isOpen(status(t.statusId)?.category);
  return (
    <div className={`flex flex-col gap-2 rounded-md border border-outline bg-card p-2.5 text-sm shadow-sm ${dragging ? "rotate-1 shadow-lg ring-2 ring-ion-deep" : "hover:border-ion-deep/60"}`}>
      <div className="flex items-center gap-1.5 text-xs text-ink-muted">
        {ty ? <TypeIcon icon={ty.icon} color={ty.color} size={13} /> : null}<span className="font-mono">{t.identifier}</span>
        <span className="ml-auto"><PriorityIcon priority={t.priority} /></span>
      </div>
      <Link to={`/p/${project.key}/t/${t.identifier}`} onPointerDown={(e) => e.stopPropagation()} draggable={false} className="line-clamp-3 leading-snug font-medium hover:underline">{t.title}</Link>
      {t.labelIds.length ? <div className="flex flex-wrap gap-1">{t.labelIds.slice(0, 3).map((id) => { const l = label(id); return l ? <LabelPill key={id} name={l.name} color={l.color} /> : null; })}</div> : null}
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        {t.dueDate ? <span className={`inline-flex items-center gap-1 ${overdue ? "text-destructive" : ""}`}><CalendarDays className="size-3.5" />{formatDate(t.dueDate)}</span> : null}
        {t.subtaskCount ? <span className="inline-flex items-center gap-1"><ListTree className="size-3.5" />{t.subtaskDoneCount}/{t.subtaskCount}</span> : null}
        {epicTitle ? <span className="inline-flex min-w-0 items-center gap-1"><Layers className="size-3.5 shrink-0" /><span className="truncate">{epicTitle}</span></span> : null}
        {assignee ? <span className="ml-auto"><Avatar name={assignee.name} image={assignee.image} size={20} /></span> : null}
      </div>
    </div>
  );
}
