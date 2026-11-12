import { useEffect, useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { BoardCard } from "./BoardCard";
import { StatusIcon } from "../../components/Visuals";
import { useProjectCtx } from "../../lib/project-context";
import { useEpics } from "../../lib/queries";
import type { Status, Ticket } from "../../lib/types";

type Cols = Record<string, string[]>;
const build = (statuses: Status[], tickets: Ticket[]): Cols => {
  const c: Cols = Object.fromEntries(statuses.map((s) => [s.id, []]));
  for (const t of tickets) (c[t.statusId] ??= []).push(t.id);
  return c;
};

function SortableCard({ ticket, epicTitle }: { ticket: Ticket; epicTitle?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }} {...attributes} {...listeners}>
      <BoardCard ticket={ticket} epicTitle={epicTitle} />
    </div>
  );
}

function Column({ status, ids, byId, epicTitle, onCreate }: { status: Status; ids: string[]; byId: Map<string, Ticket>; epicTitle: (t: Ticket) => string | undefined; onCreate: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-md bg-stone/70">
      <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium"><StatusIcon category={status.category} color={status.color} />{status.name}<span className="font-normal text-ink-muted">{ids.length}</span>
        <button className="ml-auto rounded-sm p-1 text-ink-muted hover:bg-paper-grid" aria-label={`Add ticket to ${status.name}`} onClick={onCreate}><Plus className="size-4" /></button>
      </div>
      <div ref={setNodeRef} className={`flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 ${isOver ? "rounded-md bg-paper-grid/60" : ""}`}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => { const t = byId.get(id); return t ? <SortableCard key={id} ticket={t} epicTitle={epicTitle(t)} /> : null; })}
        </SortableContext>
      </div>
    </div>
  );
}

interface Props { tickets: Ticket[]; onMove: (id: string, statusId: string, position: number) => void; onCreateIn: (statusId: string) => void }

export function BoardView({ tickets, onMove, onCreateIn }: Props) {
  const { project, config } = useProjectCtx();
  const { data: epics = [] } = useEpics(project.key);
  const byId = useMemo(() => new Map(tickets.map((t) => [t.id, t])), [tickets]);
  const [cols, setCols] = useState<Cols>(() => build(config.statuses, tickets));
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => { if (!activeId) setCols(build(config.statuses, tickets)); }, [tickets, config.statuses, activeId]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const containerOf = (id: string) => (id in cols ? id : Object.keys(cols).find((k) => cols[k].includes(id)));
  const epicTitle = (t: Ticket) => epics.find((e) => e.id === t.epicId)?.title;

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = containerOf(String(active.id)), to = containerOf(String(over.id));
    if (!from || !to || from === to) return;
    setCols((c) => {
      const overIdx = c[to].indexOf(String(over.id));
      const idx = overIdx >= 0 ? overIdx : c[to].length;
      return { ...c, [from]: c[from].filter((x) => x !== active.id), [to]: [...c[to].slice(0, idx), String(active.id), ...c[to].slice(idx)] };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const id = String(active.id);
    const container = containerOf(id);
    if (!container) return;
    let ids = cols[container];
    if (over) {
      const oi = ids.indexOf(String(over.id)), ai = ids.indexOf(id);
      if (oi >= 0 && ai >= 0 && oi !== ai) { ids = arrayMove(ids, ai, oi); setCols((c) => ({ ...c, [container]: ids })); }
    }
    const idx = ids.indexOf(id);
    const prev = idx > 0 ? byId.get(ids[idx - 1])?.position : undefined;
    const next = idx < ids.length - 1 ? byId.get(ids[idx + 1])?.position : undefined;
    const pos = prev != null && next != null ? (prev + next) / 2 : prev != null ? prev + 1000 : next != null ? next - 1000 : 1000;
    const t = byId.get(id);
    if (t && (t.statusId !== container || t.position !== pos)) onMove(id, container, pos);
  };

  const active = activeId ? byId.get(activeId) : null;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
        {config.statuses.map((s) => <Column key={s.id} status={s} ids={cols[s.id] ?? []} byId={byId} epicTitle={epicTitle} onCreate={() => onCreateIn(s.id)} />)}
      </div>
      <DragOverlay>{active ? <BoardCard ticket={active} epicTitle={epicTitle(active)} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}
