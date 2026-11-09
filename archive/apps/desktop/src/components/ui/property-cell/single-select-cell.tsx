import { useEffect, useRef, useState } from "react";
import { DndContext, type DragEndEvent, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, MoreVertical, Plus, X } from "lucide-react";
import type { NotePropertyOption } from "@/routes/notes/view/use-notes-view";
import type { CellDisplayProps, CellEditProps } from "./types";
import { randomId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const OPTION_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#64748b",
];

const DEFAULT_OPTION_COLOR = "#94a3b8";
const FLOATING_STYLE_BASE = { position: "fixed", zIndex: 50 } as const;

function useFloatingDismiss(ref: React.RefObject<HTMLElement | null>, onClose: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, onClose, active]);
}

/** Reusable badge for a single-select option. */
export function Badge({ option }: { option: NotePropertyOption }) {
  const bg = option.color ?? DEFAULT_OPTION_COLOR;
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: bg }}>
      {option.label ?? option.value}
    </span>
  );
}

export function SingleSelectCellDisplay({ value, prop, onActivate }: CellDisplayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isEmpty = value === null || value === undefined || value === "";
  // The cell's stored value is the option's `value` (label). The server's
  // validateProps rejects PATCHes whose option value isn't in col.options[i].value.
  const option = !isEmpty ? (prop.options ?? []).find((o) => o.value === value) : undefined;

  return (
    <div
      ref={ref}
      onClick={() => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect) onActivate(rect);
      }}
      className="hover:bg-accent/40 -mx-2 flex h-full min-h-[24px] cursor-pointer items-center rounded px-2 text-xs"
    >
      {!isEmpty && option ? <Badge option={option} /> : null}
    </div>
  );
}

export function SingleSelectCellEdit({ value, prop, position, size, onCommit, onClose, onPropChange }: CellEditProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  // Track which option's menu is open so the main dialog's outside-click handler
  // doesn't fire while the user is interacting with the option editor popover
  // (which renders into a Radix portal, outside the dialog's DOM tree).
  const [openOptionMenuId, setOpenOptionMenuId] = useState<string | null>(null);
  useFloatingDismiss(ref, onClose, openOptionMenuId === null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const options = prop.options ?? [];
  const filtered = query ? options.filter((o) => (o.label ?? o.value).toLowerCase().includes(query.toLowerCase())) : options;
  // Cell value is the option's `value` — what the server validates against.
  const selectedValue = typeof value === "string" ? value : "";

  const selectOption = (optionValue: string) => {
    onCommit(optionValue === selectedValue ? null : optionValue);
  };

  const addOption = () => {
    const newOption: NotePropertyOption = {
      id: randomId(),
      value: "New option",
      label: "New option",
      color: OPTION_COLORS[options.length % OPTION_COLORS.length],
    };
    onPropChange?.({ ...prop, options: [...options, newOption] });
  };

  const updateOption = (id: string, patch: Partial<NotePropertyOption>) => {
    onPropChange?.({
      ...prop,
      options: options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  };

  const deleteOption = (id: string) => {
    const deleted = options.find((o) => o.id === id);
    onPropChange?.({ ...prop, options: options.filter((o) => o.id !== id) });
    if (deleted?.value === selectedValue) onCommit(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldFilteredIdx = filtered.findIndex((o) => o.id === active.id);
    const newFilteredIdx = filtered.findIndex((o) => o.id === over.id);
    if (oldFilteredIdx < 0 || newFilteredIdx < 0) return;
    const reorderedFiltered = arrayMove(filtered, oldFilteredIdx, newFilteredIdx);
    // Merge back into the full options array: walk options in their current order;
    // for items also in filtered, take from the reordered list. Items not in filtered
    // (hidden by the search) keep their relative position.
    const filteredIds = new Set(reorderedFiltered.map((o) => o.id));
    const newOptions: NotePropertyOption[] = [];
    let i = 0;
    for (const opt of options) {
      if (filteredIds.has(opt.id)) {
        newOptions.push(reorderedFiltered[i++]);
      } else {
        newOptions.push(opt);
      }
    }
    onPropChange?.({ ...prop, options: newOptions });
  };

  const style = { ...FLOATING_STYLE_BASE, left: position.x, top: position.y, width: size.width, minHeight: size.minHeight };

  return (
    <div ref={ref} style={style} className="bg-popover text-popover-foreground flex flex-col rounded-md border shadow-md">
      <div className="border-b p-2">
        <Input autoFocus placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-7 text-xs" />
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map((o) => o.id)} strategy={verticalListSortingStrategy}>
            {filtered.map((option) => {
              const isSelected = option.value === selectedValue;
              return (
                <SortableOptionRow
                  key={option.id}
                  option={option}
                  isSelected={isSelected}
                  onSelect={() => selectOption(option.value)}
                  onUpdate={(patch) => updateOption(option.id, patch)}
                  onDelete={() => deleteOption(option.id)}
                  isMenuOpen={openOptionMenuId === option.id}
                  onMenuOpenChange={(open) => setOpenOptionMenuId(open ? option.id : null)}
                />
              );
            })}
          </SortableContext>
        </DndContext>
        {filtered.length === 0 && <p className="text-muted-foreground/60 px-1 py-2 text-center text-xs">No matches</p>}
      </div>
      <div className="border-t p-1">
        <Button variant="ghost" size="sm" className="h-7 w-full justify-start text-xs" onClick={addOption}>
          <Plus size={12} /> Add option
        </Button>
      </div>
    </div>
  );
}

function SortableOptionRow({
  option,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  isMenuOpen,
  onMenuOpenChange,
}: {
  option: NotePropertyOption;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<NotePropertyOption>) => void;
  onDelete: () => void;
  isMenuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-1.5 rounded px-1 py-1 text-xs", isSelected ? "bg-accent" : "hover:bg-accent/60", isDragging && "bg-accent/60")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing rounded p-0.5"
        aria-label={`Reorder ${option.label ?? option.value}`}
        title="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={12} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className="flex flex-1 items-center"
      >
        <Badge option={option} />
        {isSelected && <Check size={12} className="text-primary ml-auto" />}
      </button>
      <OptionMenuButton option={option} onUpdate={onUpdate} onDelete={onDelete} isOpen={isMenuOpen} onOpenChange={onMenuOpenChange} />
    </div>
  );
}

function OptionMenuButton({
  option,
  onUpdate,
  onDelete,
  isOpen,
  onOpenChange,
}: {
  option: NotePropertyOption;
  onUpdate: (patch: Partial<NotePropertyOption>) => void;
  onDelete: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Use uncontrolled Popover (Radix manages open internally) — controlled mode
  // seemed to swallow the trigger click in this nested-dnd context.
  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground/60 hover:text-foreground hover:bg-accent shrink-0 rounded p-0.5"
          title="Edit option"
          onClick={(e) => {
            e.stopPropagation();
            onOpenChange(!isOpen);
          }}
        >
          <MoreVertical size={12} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="right" className="w-56 p-2">
        <OptionEditor option={option} onUpdate={onUpdate} onDelete={onDelete} />
      </PopoverContent>
    </Popover>
  );
}

function OptionEditor({
  option,
  onUpdate,
  onDelete,
}: {
  option: NotePropertyOption;
  onUpdate: (patch: Partial<NotePropertyOption>) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(option.label ?? option.value);

  // Keep local state in sync when the option's label changes externally
  // (e.g., the parent updates it after a successful commit).
  useEffect(() => {
    setLabel(option.label ?? option.value);
  }, [option.label, option.value]);

  const commit = () => {
    const trimmed = label.trim();
    const currentLabel = option.label ?? option.value;
    if (trimmed && trimmed !== currentLabel) {
      // Keep `value` stable so cells referencing this option don't appear
      // empty after a rename. value is set at creation and never changes
      // through label edits.
      onUpdate({ label: trimmed });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide uppercase">Label</label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          className="h-7 text-xs"
          autoFocus
        />
      </div>
      <div>
        <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wide uppercase">Color</label>
        <div className="grid grid-cols-9 gap-1">
          {OPTION_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onUpdate({ color })}
              className={cn(
                "h-4 w-4 rounded-full border-2 transition-transform",
                option.color === color ? "border-foreground scale-110" : "border-transparent",
              )}
              style={{ backgroundColor: color }}
              aria-label={`Color ${color}`}
            />
          ))}
        </div>
      </div>
      <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={onDelete}>
        <X size={12} /> Delete option
      </Button>
    </div>
  );
}
