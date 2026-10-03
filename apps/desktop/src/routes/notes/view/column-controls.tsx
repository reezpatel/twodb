import { useId } from "react";
import { DndContext, type DragEndEvent, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { VisibilityState } from "@tanstack/react-table";
import { Columns3, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ColumnOption {
  id: string;
  label: string;
}

export interface ColumnControlsProps {
  columns: ColumnOption[];
  columnOrder: string[];
  columnVisibility: VisibilityState;
  onColumnOrderChange: (order: string[]) => void;
  onColumnVisibilityChange: (visibility: VisibilityState) => void;
}

function isVisible(visibility: VisibilityState, id: string): boolean {
  return visibility[id] !== false;
}

function SortableRow({ id, label, visible, onToggle }: { id: string; label: string; visible: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded px-2 py-1.5 text-xs",
        visible ? "hover:bg-accent/40" : "text-muted-foreground/60 hover:bg-accent/20",
        isDragging && "bg-accent shadow-sm",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label={`Reorder ${label}`}
        title="Drag to reorder"
      >
        <GripVertical size={12} />
      </button>
      <Checkbox checked={visible} onCheckedChange={onToggle} aria-label={`Show ${label}`} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </div>
  );
}

export function ColumnControls({ columns, columnOrder, columnVisibility, onColumnOrderChange, onColumnVisibilityChange }: ColumnControlsProps) {
  const triggerId = useId();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = columnOrder.indexOf(String(active.id));
    const newIndex = columnOrder.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onColumnOrderChange(arrayMove(columnOrder, oldIndex, newIndex));
  };

  const toggle = (id: string) => {
    const next = { ...columnVisibility, [id]: !isVisible(columnVisibility, id) };
    onColumnVisibilityChange(next);
  };

  const ordered = columnOrder.length
    ? columnOrder.map((id) => columns.find((c) => c.id === id) ?? { id, label: id }).filter((c): c is ColumnOption => Boolean(c))
    : columns;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button id={triggerId} variant="outline" size="sm" className="h-7 text-xs" title="Configure columns">
          <Columns3 size={13} /> Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56">
        <div className="text-muted-foreground/70 mb-1 text-[10px] font-semibold tracking-wide uppercase">Columns</div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ordered.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col">
              {ordered.map((c) => (
                <SortableRow key={c.id} id={c.id} label={c.label} visible={isVisible(columnVisibility, c.id)} onToggle={() => toggle(c.id)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </PopoverContent>
    </Popover>
  );
}
