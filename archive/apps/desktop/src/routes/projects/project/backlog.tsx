import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Check, ChevronDown, LayoutGrid, List, ListTodo, Play, Plus, Search, Zap } from "lucide-react";
import type { ProjectDetail, Sprint, TicketSummary } from "../use-projects";
import { useProjectMutation, useTickets } from "../use-projects";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketCardBody } from "./board";
import { NewTicketDialog } from "./dialogs";
import { TicketRow, shortDate } from "./ticket-row";

type View = "cards" | "list";

function DraggableTicket({ ticket, view, onOpen }: { ticket: TicketSummary; view: View; onOpen: () => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: ticket.id });
  if (view === "list")
    return <TicketRow ref={setNodeRef} {...attributes} {...listeners} ticket={ticket} onOpen={onOpen} className={cn(isDragging && "opacity-30")} />;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={cn(
        "bg-card hover:border-foreground/20 cursor-pointer rounded-xl border p-4 shadow-sm transition-all hover:-translate-y-px hover:shadow-md",
        isDragging && "opacity-30",
      )}
    >
      <TicketCardBody ticket={ticket} />
    </div>
  );
}

function Section({
  id,
  icon,
  title,
  meta,
  actions,
  showProgress,
  tickets,
  view,
  defaultOpen,
  doneIds,
  onOpen,
  onAdd,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  meta?: string;
  actions?: React.ReactNode;
  showProgress?: boolean;
  tickets: TicketSummary[];
  view: View;
  defaultOpen?: boolean;
  doneIds: Set<string>;
  onOpen: (ticketId: string) => void;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  const { setNodeRef, isOver } = useDroppable({ id });
  const done = tickets.filter((t) => doneIds.has(t.statusId)).length;
  const pts = tickets.reduce((a, t) => a + (t.estimate ?? 0), 0);
  return (
    <section ref={setNodeRef} className={cn("rounded-2xl border p-2 transition-colors", isOver ? "bg-accent/40 border-primary/50" : "bg-muted/20")}>
      <div className="flex h-12 items-center gap-3 px-3">
        <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setOpen((v) => !v)}>
          <ChevronDown size={14} className={cn("text-muted-foreground shrink-0 transition-transform", !open && "-rotate-90")} />
          {icon}
          <span className="truncate text-sm font-semibold">{title}</span>
          <span className="text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-[11px] tabular-nums">{tickets.length}</span>
          {meta && <span className="text-muted-foreground hidden truncate text-xs sm:block">{meta}</span>}
        </button>
        {showProgress && tickets.length > 0 && (
          <div className="hidden items-center gap-3 md:flex">
            <Progress value={(done / tickets.length) * 100} className="h-1.5 w-28" />
            <span className="text-muted-foreground text-xs tabular-nums">
              {done}/{tickets.length} · {pts} pts
            </span>
          </div>
        )}
        {actions}
        <Button size="icon" variant="ghost" className="text-muted-foreground size-8" title="New ticket" onClick={onAdd}>
          <Plus size={15} />
        </Button>
      </div>
      {open && (
        <div className="px-1 pt-1 pb-1">
          {tickets.length === 0 ? (
            <button
              onClick={onAdd}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/30 flex h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-sm transition-colors"
            >
              <Plus size={16} />
              Drop tickets here or create one
            </button>
          ) : view === "cards" ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {tickets.map((t) => (
                <DraggableTicket key={t.id} ticket={t} view={view} onOpen={() => onOpen(t.id)} />
              ))}
            </div>
          ) : (
            <div className="bg-card divide-border/60 divide-y overflow-hidden rounded-xl border">
              {tickets.map((t) => (
                <DraggableTicket key={t.id} ticket={t} view={view} onOpen={() => onOpen(t.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Backlog tab: sprint planning with card (or list) layout; drag between sections to plan/unplan. */
export function Backlog({ detail, subprojectId }: { detail: ProjectDetail; subprojectId?: string }) {
  const navigate = useNavigate();
  const tickets = useTickets(detail.project.id, subprojectId ? { subprojectId } : {});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("cards");
  const [dragging, setDragging] = useState<TicketSummary | null>(null);
  const [adding, setAdding] = useState<{ sprint?: Sprint } | null>(null);

  const move = useProjectMutation(
    ({ ticketId, sprintId, inBacklog }: { ticketId: string; sprintId: string | null; inBacklog: boolean }) =>
      api(`/api/projects/tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify({ sprintId, inBacklog }) }),
    [detail.project.id],
  );
  const patchSprint = useProjectMutation(
    ({ id, status }: { id: string; status: string }) => api(`/api/projects/sprints/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    [detail.project.id],
  );

  const doneIds = useMemo(() => new Set(detail.statuses.filter((s) => s.category === "done" || s.category === "canceled").map((s) => s.id)), [detail.statuses]);
  const sprints = useMemo(
    () => detail.sprints.filter((s) => s.status !== "closed").sort((a, b) => (a.status === "active" ? -1 : b.status === "active" ? 1 : 0)),
    [detail.sprints],
  );

  const { backlog, perSprint } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = (tickets.data ?? []).filter((t) => !q || t.title.toLowerCase().includes(q) || t.identifier.toLowerCase().includes(q));
    const perSprint = new Map<string, TicketSummary[]>();
    for (const s of sprints) perSprint.set(s.id, []);
    for (const t of all) if (!t.inBacklog && t.sprintId) perSprint.get(t.sprintId)?.push(t);
    return { backlog: all.filter((t) => t.inBacklog), perSprint };
  }, [tickets.data, query, sprints]);

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const ticketId = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    if (over === "backlog") move.mutate({ ticketId, sprintId: null, inBacklog: true });
    else if (over.startsWith("sprint:")) move.mutate({ ticketId, sprintId: over.slice(7), inBacklog: false });
  };

  const open = (ticketId: string) => navigate(`/apps/projects/${detail.project.id}/ticket/${ticketId}`);

  const sprintActions = (s: Sprint) =>
    s.status === "planned" ? (
      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => patchSprint.mutate({ id: s.id, status: "active" })}>
        <Play size={11} /> Start sprint
      </Button>
    ) : (
      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => patchSprint.mutate({ id: s.id, status: "closed" })}>
        <Check size={12} /> Complete
      </Button>
    );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDragging((tickets.data ?? []).find((t) => t.id === String(e.active.id)) ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-8 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h2 className="text-lg font-semibold">Backlog</h2>
            <p className="text-muted-foreground mt-0.5 text-sm">Plan work by dragging tickets into a sprint.</p>
          </div>
          <div className="relative w-64">
            <Search size={14} className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tickets…" className="h-9 pl-9 text-sm" />
          </div>
          <div className="bg-muted flex rounded-lg p-0.5">
            {([["cards", LayoutGrid], ["list", List]] as const).map(([v, Icon]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-label={`${v} view`}
                className={cn("flex size-8 items-center justify-center rounded-md transition-colors", view === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
          <Button size="sm" className="h-9 gap-1.5" onClick={() => setAdding({})}>
            <Plus size={14} /> New ticket
          </Button>
        </div>
        {tickets.isPending && (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        )}
        {sprints.map((s) => (
          <Section
            key={s.id}
            id={`sprint:${s.id}`}
            icon={<Zap size={14} className={s.status === "active" ? "text-amber-500" : "text-muted-foreground"} />}
            title={s.name}
            meta={[s.status === "active" ? "Active" : "Planned", s.startDate ? `${shortDate(s.startDate)} → ${s.endDate ? shortDate(s.endDate) : "?"}` : null].filter(Boolean).join(" · ")}
            actions={sprintActions(s)}
            showProgress
            tickets={perSprint.get(s.id) ?? []}
            view={view}
            defaultOpen={s.status === "active"}
            doneIds={doneIds}
            onOpen={open}
            onAdd={() => setAdding({ sprint: s })}
          />
        ))}
        <Section
          id="backlog"
          icon={<ListTodo size={14} className="text-muted-foreground" />}
          title="Backlog"
          tickets={backlog}
          view={view}
          doneIds={doneIds}
          onOpen={open}
          onAdd={() => setAdding({})}
        />
      </div>
      <DragOverlay>
        {dragging ? (
          <div className="bg-card w-80 rounded-xl border p-4 shadow-xl">
            <TicketCardBody ticket={dragging} />
          </div>
        ) : null}
      </DragOverlay>
      {adding && (
        <NewTicketDialog
          open
          onClose={() => setAdding(null)}
          detail={detail}
          subprojectId={subprojectId}
          sprintId={adding.sprint?.id}
          sprintName={adding.sprint?.name}
          backlog={!adding.sprint}
        />
      )}
    </DndContext>
  );
}
