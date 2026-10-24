import { useState } from "react";
import { useNavigate } from "react-router";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Archive, ChevronDown, ListTodo, Plus, Zap } from "lucide-react";
import type { ProjectDetail, Sprint, TicketSummary } from "../use-projects";
import { useProjectMutation, useTickets } from "../use-projects";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { PriorityIcon, TypeIcon, LabelChip } from "./board";

// itsaplan/Linear-style backlog: sprint groups as collapsible sections with
// drag between sections and the backlog group at the bottom.

function BacklogRow({ ticket, statusName, statusColor, onOpen }: { ticket: TicketSummary; statusName: string; statusColor: string; onOpen: () => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: ticket.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={cn("hover:bg-accent/50 flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm", isDragging && "opacity-40")}
    >
      <TypeIcon type={ticket.type} />
      <span className="text-muted-foreground w-16 shrink-0 font-mono text-[11px]">{ticket.identifier}</span>
      <PriorityIcon priority={ticket.priority} />
      <span className="min-w-0 flex-1 truncate">{ticket.title}</span>
      {ticket.labels.slice(0, 3).map((l) => (
        <LabelChip key={l.id} name={l.name} color={l.color} />
      ))}
      {ticket.estimate != null && <span className="text-muted-foreground w-8 text-right font-mono text-[11px]">{ticket.estimate}</span>}
      <span className="flex w-20 items-center gap-1.5 text-[11px]">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: statusColor }} />
        <span className="text-muted-foreground truncate">{statusName}</span>
      </span>
      {ticket.assignee && (
        <Avatar className="size-5 shrink-0">
          {ticket.assignee.image && <AvatarImage src={ticket.assignee.image} />}
          <AvatarFallback className="text-[8px]">{ticket.assignee.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

function Section({
  id,
  icon,
  title,
  subtitle,
  tickets,
  defaultOpen,
  projectId,
  subprojectId,
  onOpen,
  statusOf,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  tickets: TicketSummary[];
  defaultOpen?: boolean;
  projectId: string;
  subprojectId?: string;
  onOpen: (ticketId: string) => void;
  statusOf: (statusId: string) => { name: string; color: string };
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className={cn("rounded-lg border", isOver && "ring-primary/40 ring-1")}>
      <button className="flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => setOpen((v) => !v)}>
        <ChevronDown size={13} className={cn("text-muted-foreground transition-transform", !open && "-rotate-90")} />
        {icon}
        <span className="text-sm font-semibold">{title}</span>
        {subtitle && <span className="text-muted-foreground text-xs">{subtitle}</span>}
        <span className="text-muted-foreground ml-auto text-xs">{tickets.length}</span>
      </button>
      {open && (
        <div ref={setNodeRef} className={cn("flex flex-col gap-0.5 border-t px-1.5 py-1.5", tickets.length === 0 && "py-3")}>
          {tickets.map((t) => {
            const s = statusOf(t.statusId);
            return <BacklogRow key={t.id} ticket={t} statusName={s.name} statusColor={s.color} onOpen={() => onOpen(t.id)} />;
          })}
          {tickets.length === 0 && <p className="text-muted-foreground px-2 text-center text-xs">Drop tickets here</p>}
          <SectionQuickAdd
            projectId={projectId}
            subprojectId={subprojectId}
            backlog={id === "backlog"}
            sprintId={id.startsWith("sprint:") ? id.slice(7) : undefined}
          />
        </div>
      )}
    </div>
  );
}

function SectionQuickAdd({ projectId, subprojectId, backlog, sprintId }: { projectId: string; subprojectId?: string; backlog: boolean; sprintId?: string }) {
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState(false);
  const create = useProjectMutation(
    (t: string) =>
      api(`/api/projects/projects/${projectId}/tickets`, {
        method: "POST",
        body: JSON.stringify({ title: t, subprojectId, inBacklog: backlog, ...(sprintId ? { sprintId } : {}) }),
      }),
    [projectId],
  );
  if (!subprojectId) return null;
  if (!editing)
    return (
      <button className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded px-2 py-1 text-xs" onClick={() => setEditing(true)}>
        <Plus size={12} /> New ticket
      </button>
    );
  return (
    <form
      className="px-1"
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
        onBlur={() => !title.trim() && setEditing(false)}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        placeholder="Ticket title…"
        className="h-7 text-xs"
      />
    </form>
  );
}

/** Backlog tab: non-closed sprints as sections, backlog bucket at the bottom.
 * Drag between sections to plan/unplan. */
export function Backlog({ detail, subprojectId }: { detail: ProjectDetail; subprojectId?: string }) {
  const navigate = useNavigate();
  const tickets = useTickets(detail.project.id, subprojectId ? { subprojectId } : {});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const move = useProjectMutation(
    ({ ticketId, sprintId, inBacklog }: { ticketId: string; sprintId: string | null; inBacklog: boolean }) =>
      api(`/api/projects/tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify({ sprintId, inBacklog }) }),
    [detail.project.id],
  );

  const statusById = new Map(detail.statuses.map((s) => [s.id, s]));
  const statusOf = (statusId: string) => statusById.get(statusId) ?? { name: "?", color: "#888" };

  const sprints = detail.sprints.filter((s) => s.status !== "closed");
  const backlog = (tickets.data ?? []).filter((t) => t.inBacklog);
  const perSprint = new Map<string, TicketSummary[]>();
  for (const s of sprints) perSprint.set(s.id, []);
  for (const t of tickets.data ?? []) {
    if (t.inBacklog || !t.sprintId) continue;
    perSprint.get(t.sprintId)?.push(t);
  }

  const onDragEnd = (e: DragEndEvent) => {
    const ticketId = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    if (over === "backlog") move.mutate({ ticketId, sprintId: null, inBacklog: true });
    else if (over.startsWith("sprint:")) move.mutate({ ticketId, sprintId: over.slice(7), inBacklog: false });
  };

  const open = (ticketId: string) => navigate(`/apps/projects/${detail.project.id}/ticket/${ticketId}`);

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-3 overflow-y-auto p-6">
        {sprints.map((s: Sprint) => (
          <Section
            key={s.id}
            id={`sprint:${s.id}`}
            icon={<Zap size={13} className={s.status === "active" ? "text-amber-500" : "text-muted-foreground"} />}
            title={s.name}
            subtitle={s.status === "active" ? "active" : s.startDate ? `${s.startDate} → ${s.endDate ?? "?"}` : undefined}
            tickets={perSprint.get(s.id) ?? []}
            defaultOpen={s.status === "active"}
            projectId={detail.project.id}
            subprojectId={subprojectId ?? detail.subprojects[0]?.id}
            onOpen={open}
            statusOf={statusOf}
          />
        ))}
        <Section
          id="backlog"
          icon={<ListTodo size={13} className="text-muted-foreground" />}
          title="Backlog"
          tickets={backlog}
          projectId={detail.project.id}
          subprojectId={subprojectId ?? detail.subprojects[0]?.id}
          onOpen={open}
          statusOf={statusOf}
        />
        <p className="text-muted-foreground flex items-center gap-1.5 px-1 text-[11px]">
          <Archive size={10} /> Drag a ticket into a sprint to plan it, or into Backlog to unplan.
        </p>
      </div>
    </DndContext>
  );
}
