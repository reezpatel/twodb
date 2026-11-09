import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Ban, Bug, ChevronsLeftRight, CircleDot, GitPullRequest, Hash, Loader2, Plus, Square, SquareCheckBig, Star, Zap } from "lucide-react";
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

const CATEGORY_LABEL: Record<string, string> = { backlog: "Backlog", todo: "Todo", in_progress: "In progress", done: "Done", canceled: "Canceled" };

/** Linear-style status glyph driven by the status category + color. */
export function StatusIcon({ category, color, size = 14 }: { category: string; color?: string; size?: number }) {
  const c = color ?? "currentColor";
  const r = size / 2 - 1.25;
  const cx = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-label={CATEGORY_LABEL[category] ?? category}>
      {category === "backlog" && <circle cx={cx} cy={cx} r={r} fill="none" stroke={c} strokeWidth="1.5" strokeDasharray="2 2" opacity={0.7} />}
      {category === "todo" && <circle cx={cx} cy={cx} r={r} fill="none" stroke={c} strokeWidth="1.5" />}
      {category === "in_progress" && (
        <>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={c} strokeWidth="1.5" />
          <path d={`M ${cx} ${cx - r / 2} A ${r / 2} ${r / 2} 0 0 1 ${cx} ${cx + r / 2} Z`} fill={c} />
        </>
      )}
      {category === "done" && (
        <>
          <circle cx={cx} cy={cx} r={r + 0.75} fill={c} />
          <path d={`M ${size * 0.3} ${size * 0.52} L ${size * 0.45} ${size * 0.66} L ${size * 0.7} ${size * 0.36}`} fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {category === "canceled" && (
        <>
          <circle cx={cx} cy={cx} r={r + 0.75} fill={c} />
          <path d={`M ${size * 0.35} ${size * 0.35} L ${size * 0.65} ${size * 0.65} M ${size * 0.65} ${size * 0.35} L ${size * 0.35} ${size * 0.65}`} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const chip = "text-muted-foreground inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[11px] leading-none whitespace-nowrap";

/** Card content — shared between the board card and the drag overlay. */
export function TicketCardBody({ ticket }: { ticket: TicketSummary }) {
  const t = TYPE_ICON[ticket.type] ?? TYPE_ICON.issue;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground font-mono text-xs">{ticket.identifier}</span>
        <PriorityIcon priority={ticket.priority} />
      </div>
      <div className="flex items-start gap-2">
        {ticket.status && <span className="mt-0.5"><StatusIcon category={ticket.status.category} color={ticket.status.color} /></span>}
        <span className="text-foreground line-clamp-2 text-[13px] leading-snug font-medium">{ticket.title}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {ticket.blockedBy.length > 0 && (
          <span className={cn(chip, "text-amber-500")}>
            <GitPullRequest size={10} /> blocked
          </span>
        )}
        {ticket.estimate != null && (
          <span className={chip}>
            <Hash size={10} /> {ticket.estimate}
          </span>
        )}
        <span className={chip}>
          <t.icon size={10} className={t.cls} /> {t.label}
        </span>
        {ticket.labels.map((l) => (
          <span key={l.id} className={chip}>
            <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: l.color }} />
            {l.name}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="text-muted-foreground/70 text-[11px]">
          Created {shortDate(ticket.createdAt)} · Updated {shortDate(ticket.updatedAt)}
        </span>
        {ticket.assignee && (
          <Avatar className="size-5">
            {ticket.assignee.image && <AvatarImage src={ticket.assignee.image} />}
            <AvatarFallback className="text-[8px]">{ticket.assignee.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}

function BoardCard({ ticket, onOpen }: { ticket: TicketSummary; onOpen: () => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: ticket.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={cn("bg-card hover:bg-accent/60 cursor-pointer rounded-xl p-4 transition-colors", isDragging && "opacity-40")}
    >
      <TicketCardBody ticket={ticket} />
    </div>
  );
}

function QuickAdd({ projectId, subprojectId, statusId, onDone }: { projectId: string; subprojectId?: string; statusId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const create = useProjectMutation(
    (t: string) =>
      api(`/api/projects/projects/${projectId}/tickets`, { method: "POST", body: JSON.stringify({ title: t, subprojectId, statusId, inBacklog: false }) }),
    [projectId],
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
        onBlur={() => !title.trim() && onDone()}
        onKeyDown={(e) => e.key === "Escape" && onDone()}
        placeholder="Ticket title…  ⏎ to add"
        className="bg-card h-10 rounded-xl text-sm"
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
  const [adding, setAdding] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const canAdd = !!subprojectId;

  if (collapsed)
    return (
      <div ref={setNodeRef} className={cn("flex w-12 shrink-0 flex-col items-center gap-3 rounded-xl py-3", isOver && "bg-accent/60")}>
        <Button variant="ghost" size="icon" className="text-muted-foreground size-7" onClick={() => setCollapsed(false)} aria-label="expand column">
          <ChevronsLeftRight size={14} />
        </Button>
        <StatusIcon category={status.category} color={status.color} />
        <span className="text-muted-foreground text-xs tabular-nums">{tickets.length}</span>
        <span className="text-sm font-medium [writing-mode:vertical-rl]">{status.name}</span>
      </div>
    );

  return (
    <div className="group/column flex w-[340px] shrink-0 flex-col">
      <div className="mb-4 flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5 text-sm font-medium">
          <StatusIcon category={status.category} color={status.color} />
          {status.name}
          <span className="text-muted-foreground text-xs tabular-nums">{tickets.length}</span>
        </div>
        <div className="text-muted-foreground flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setCollapsed(true)} aria-label="collapse column" title="Collapse">
            <ChevronsLeftRight size={14} />
          </Button>
          {canAdd && (
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setAdding(true)} aria-label="new ticket" title="New ticket">
              <Plus size={14} />
            </Button>
          )}
        </div>
      </div>
      <div ref={setNodeRef} className={cn("flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-xl pb-4 transition-colors", isOver && "bg-accent/30 ring-primary/40 ring-1")}>
        {adding && canAdd && <QuickAdd projectId={projectId} subprojectId={subprojectId} statusId={status.id} onDone={() => setAdding(false)} />}
        {tickets.map((t) => (
          <BoardCard key={t.id} ticket={t} onOpen={() => onOpen(t.id)} />
        ))}
        {canAdd && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-muted-foreground hover:bg-accent/40 hover:text-foreground flex h-9 w-full items-center justify-center rounded-xl border border-dashed transition-colors"
            aria-label="new ticket"
          >
            <Plus size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

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
      <div className="flex h-full gap-5 overflow-x-auto px-8 py-6">
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
          <div className="bg-card w-80 rounded-xl p-4 shadow-xl ring-1 ring-white/10">
            <TicketCardBody ticket={active} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
