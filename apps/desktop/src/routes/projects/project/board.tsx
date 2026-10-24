import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Ban, Bug, CircleDot, GitPullRequest, Hash, Loader2, Plus, Square, SquareCheckBig, Star, Zap } from "lucide-react";
import type { ProjectDetail, Status, TicketSummary } from "../use-projects";
import { useProjectMutation, useTickets } from "../use-projects";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// itsaplan-style kanban: fixed-width columns, colored state icons, card with
// identifier/priority row, title with status icon, meta badge row, assignee footer.

export const TYPE_ICON: Record<string, { icon: typeof Square; cls: string; label: string }> = {
  issue: { icon: CircleDot, cls: "text-muted-foreground", label: "Issue" },
  epic: { icon: Zap, cls: "text-lavender-400", label: "Epic" },
  bug: { icon: Bug, cls: "text-destructive", label: "Bug" },
  task: { icon: Square, cls: "text-muted-foreground", label: "Task" },
  feature: { icon: Star, cls: "text-amber-500", label: "Feature" },
  chore: { icon: SquareCheckBig, cls: "text-muted-foreground", label: "Chore" },
};

export function TypeIcon({ type, className }: { type: string; className?: string }) {
  const t = TYPE_ICON[type] ?? TYPE_ICON.issue;
  const Icon = t.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0">
          <Icon size={13} className={cn(t.cls, className)} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{t.label}</TooltipContent>
    </Tooltip>
  );
}

const PRIORITY_ICON: Record<string, { bars: number; cls: string; label: string }> = {
  none: { bars: 0, cls: "text-muted-foreground/50", label: "No priority" },
  low: { bars: 1, cls: "text-muted-foreground", label: "Low" },
  medium: { bars: 2, cls: "text-muted-foreground", label: "Medium" },
  high: { bars: 3, cls: "text-foreground", label: "High" },
  urgent: { bars: 3, cls: "text-destructive", label: "Urgent" },
};

export function PriorityIcon({ priority }: { priority: string }) {
  const p = PRIORITY_ICON[priority] ?? PRIORITY_ICON.none;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-end gap-px", p.cls)} title={p.label}>
          {[1, 2, 3].map((i) => (
            <span key={i} className={cn("w-[3px] rounded-sm", i <= p.bars ? "bg-current" : "bg-current opacity-25")} style={{ height: 3 + i * 2 }} />
          ))}
          {priority === "urgent" && <Ban size={10} className="ml-0.5" />}
        </span>
      </TooltipTrigger>
      <TooltipContent>{p.label}</TooltipContent>
    </Tooltip>
  );
}

export function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <Badge variant="outline" className="text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]">
      <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </Badge>
  );
}

/** Card content — shared between the board card and the drag overlay. */
export function TicketCardBody({ ticket }: { ticket: TicketSummary }) {
  return (
    <>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-muted-foreground font-mono text-[11px]">{ticket.identifier}</span>
        <PriorityIcon priority={ticket.priority} />
      </div>
      <div className="mb-2 flex items-start gap-1.5">
        <span className="mt-px inline-flex shrink-0">
          <TypeIcon type={ticket.type} />
        </span>
        <span className="text-foreground line-clamp-2 text-sm leading-snug">{ticket.title}</span>
      </div>
      {(ticket.labels.length > 0 || ticket.estimate != null || ticket.blockedBy.length > 0 || ticket.milestoneId || ticket.sprintId) && (
        <div className="flex min-h-[22px] flex-wrap items-center gap-1">
          {ticket.blockedBy.length > 0 && (
            <Badge variant="outline" className="rounded-full px-1.5 py-0.5 text-[10px] text-amber-500">
              <GitPullRequest size={10} /> blocked
            </Badge>
          )}
          {ticket.estimate != null && (
            <Badge variant="outline" className="text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]">
              <Hash size={10} /> {ticket.estimate}
            </Badge>
          )}
          {ticket.labels.map((l) => (
            <LabelChip key={l.id} name={l.name} color={l.color} />
          ))}
        </div>
      )}
      {ticket.assignee && (
        <div className="mt-2 flex items-center justify-end">
          <Avatar className="size-5">
            {ticket.assignee.image && <AvatarImage src={ticket.assignee.image} />}
            <AvatarFallback className="text-[8px]">{ticket.assignee.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>
      )}
    </>
  );
}

function BoardCard({ ticket, onOpen }: { ticket: TicketSummary; onOpen: () => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: ticket.id });
  // A drag still fires click on drop — dnd-kit's PointerSensor with a distance
  // threshold keeps clicks clean.
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={cn("bg-card hover:bg-accent/50 cursor-pointer rounded-md border p-2.5 shadow-sm transition-colors", isDragging && "opacity-40")}
    >
      <TicketCardBody ticket={ticket} />
    </div>
  );
}

function QuickAdd({ projectId, subprojectId, statusId }: { projectId: string; subprojectId?: string; statusId: string }) {
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const create = useProjectMutation(
    (t: string) =>
      api(`/api/projects/projects/${projectId}/tickets`, { method: "POST", body: JSON.stringify({ title: t, subprojectId, statusId, inBacklog: false }) }),
    [projectId],
  );
  if (!subprojectId) return null;
  if (!open)
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground h-7 w-full justify-start gap-1.5 text-xs opacity-0 transition-opacity group-hover/column:opacity-100 focus-visible:opacity-100"
        onClick={() => setOpen(true)}
      >
        <Plus size={13} /> New ticket
      </Button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = title.trim();
        if (!t) return;
        setTitle("");
        create.mutate(t);
      }}
    >
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !title.trim() && setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Ticket title…"
        className="h-8 text-xs"
      />
    </form>
  );
}

function BoardColumn({
  status,
  tickets,
  projectId,
  subprojectId,
  onOpen,
}: {
  status: Status;
  tickets: TicketSummary[];
  projectId: string;
  subprojectId?: string;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <div className="group/column flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: status.color }} />
          {status.name}
          <span className="text-muted-foreground text-xs">{tickets.length}</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground size-6"
              onClick={() => {
                // open the column's quick-add by focusing its trigger
                setNodeRef; // no-op; QuickAdd handles its own open state
              }}
              aria-label="new ticket"
              disabled
            >
              <Plus size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Scroll down — quick add at the column bottom</TooltipContent>
        </Tooltip>
      </div>
      <div
        ref={setNodeRef}
        className={cn("bg-muted/40 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg p-2 transition-colors", isOver && "bg-accent/60 ring-primary/40 ring-1")}
      >
        {tickets.map((t) => (
          <BoardCard key={t.id} ticket={t} onOpen={() => onOpen(t.id)} />
        ))}
        <QuickAdd projectId={projectId} subprojectId={subprojectId} statusId={status.id} />
      </div>
    </div>
  );
}

/** Kanban board — one column per status (subproject override set or the
 * project's), dnd-kit drag between columns. Backlog-flagged tickets don't show. */
export function Board({ detail, subprojectId }: { detail: ProjectDetail; subprojectId?: string }) {
  const navigate = useNavigate();
  const tickets = useTickets(detail.project.id, subprojectId ? { subprojectId } : {});
  const [active, setActive] = useState<TicketSummary | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const statuses = useMemo(() => {
    if (subprojectId) {
      const overrides = detail.statuses.filter((s) => s.subprojectId === subprojectId);
      if (overrides.length) return overrides;
    }
    return detail.statuses.filter((s) => s.subprojectId === null);
  }, [detail.statuses, subprojectId]);

  const move = useProjectMutation(
    ({ ticketId, statusId }: { ticketId: string; statusId: string }) =>
      api(`/api/projects/tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify({ statusId, inBacklog: false }) }),
    [detail.project.id],
  );

  const byStatus = useMemo(() => {
    const map = new Map<string, TicketSummary[]>();
    for (const s of statuses) map.set(s.id, []);
    for (const t of tickets.data ?? []) {
      if (t.inBacklog) continue;
      map.get(t.statusId)?.push(t);
    }
    return map;
  }, [tickets.data, statuses]);

  const firstSubproject = subprojectId ?? detail.subprojects[0]?.id;
  const ticketById = useMemo(() => new Map((tickets.data ?? []).map((t) => [t.id, t])), [tickets.data]);

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const ticketId = String(e.active.id);
    const statusId = e.over ? String(e.over.id) : null;
    if (statusId && ticketById.get(ticketId)?.statusId !== statusId) move.mutate({ ticketId, statusId });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActive(ticketById.get(String(e.active.id)) ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {statuses.map((s) => (
          <BoardColumn
            key={s.id}
            status={s}
            tickets={byStatus.get(s.id) ?? []}
            projectId={detail.project.id}
            subprojectId={firstSubproject}
            onOpen={(ticketId) => navigate(`/apps/projects/${detail.project.id}/ticket/${ticketId}`)}
          />
        ))}
        {tickets.isPending && <Loader2 size={16} className="text-muted-foreground mt-6 animate-spin" />}
        {statuses.length === 0 && !tickets.isPending && <p className="text-muted-foreground p-4 text-sm">No statuses — add some in Settings.</p>}
      </div>
      <DragOverlay>
        {active ? (
          <div className="bg-card w-64 rounded-md border p-2.5 shadow-lg">
            <TicketCardBody ticket={active} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
