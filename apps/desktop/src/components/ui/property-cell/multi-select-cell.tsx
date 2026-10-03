import { useEffect, useRef, useState } from "react";
import { GripVertical, MoreVertical, Plus, X } from "lucide-react";
import type { DragEndEvent } from "@dnd-kit/core";
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { NotePropertyOption } from "@/routes/notes/view/use-notes-view";
import type { CellDisplayProps, CellEditProps } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, randomId } from "@/lib/utils";

const DEFAULT_OPTION_COLOR = "#94a3b8";
const FLOATING_STYLE_BASE = { position: "fixed", zIndex: 50 } as const;
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

function useFloatingDismiss(ref: React.RefObject<HTMLElement | null>, onClose: () => void, active = true, onBeforeClose?: () => void) {
  useEffect(() => {
    if (!active) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        onBeforeClose?.();
        onClose();
      }
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
  }, [ref, onClose, active, onBeforeClose]);
}

function Badge({ option }: { option: NotePropertyOption }) {
  const bg = option.color ?? DEFAULT_OPTION_COLOR;
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: bg }}>
      {option.label ?? option.value}
    </span>
  );
}

/** Multi-select display: shows all currently-selected option badges. */
export function MultiSelectCellDisplay({ value, prop, onActivate }: CellDisplayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const ids = Array.isArray(value) ? (value as unknown[]).filter((v): v is string => typeof v === "string") : [];
  const opts = (prop.options ?? []).filter((o) => ids.includes(o.value));
  return (
    <div
      ref={ref}
      onClick={() => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect) onActivate(rect);
      }}
      className="hover:bg-accent/40 -mx-2 flex h-full min-h-[24px] cursor-pointer flex-nowrap items-center gap-1 overflow-hidden rounded px-2 text-xs"
    >
      {opts.map((o) => (
        <Badge key={o.id} option={o} />
      ))}
    </div>
  );
}

/** Multi-select editor: popover with checkboxes per option, drag-to-reorder,
 * add new option, edit label/color/delete (same option row as single-select). */
export function MultiSelectCellEdit({ value, prop, position, size, onCommit, onClose, onPropChange }: CellEditProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [openOptionMenuId, setOpenOptionMenuId] = useState<string | null>(null);
  useFloatingDismiss(ref, onClose, openOptionMenuId === null, () => {
    // Commit current selection on outside-click
    if (inputRef.current) {
      const arr = JSON.parse(inputRef.current.value) as string[];
      onCommit(arr.length ? arr : null);
    }
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const options = prop.options ?? [];
  const filtered = query ? options.filter((o) => (o.label ?? o.value).toLowerCase().includes(query.toLowerCase())) : options;

  // Local multi-select state — accumulated as the user toggles, committed once
  // on close via the hidden input + useFloatingDismiss's onBeforeClose.
  const [selected, setSelected] = useState<string[]>(Array.isArray(value) ? (value as string[]) : []);
  useEffect(() => {
    setSelected(Array.isArray(value) ? (value as string[]) : []);
  }, [value]);
  const selectedSet = new Set(selected);

  const toggle = (optionValue: string) => {
    setSelected((prev) => (prev.includes(optionValue) ? prev.filter((v) => v !== optionValue) : [...prev, optionValue]));
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

  // Create a new option from the search query. Used by the "Create '<query>'"
  // item that appears when the user types something that doesn't already match
  // an existing option. Just adds the option — user can click it in the list
  // to select it (avoiding a race where selection commits before the option
  // is saved and fails server-side validation).
  const createOption = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const newOption: NotePropertyOption = {
      id: randomId(),
      value: trimmed,
      label: trimmed,
      color: OPTION_COLORS[options.length % OPTION_COLORS.length],
    };
    onPropChange?.({ ...prop, options: [...options, newOption] });
    setQuery("");
  };

  const showCreate = query.trim() !== "" && !options.some((o) => o.value === query.trim());

  const updateOption = (id: string, patch: Partial<NotePropertyOption>) => {
    onPropChange?.({ ...prop, options: options.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  };

  const deleteOption = (id: string) => {
    const deleted = options.find((o) => o.id === id);
    onPropChange?.({ ...prop, options: options.filter((o) => o.id !== id) });
    if (deleted && selectedSet.has(deleted.value)) {
      onCommit(selected.filter((v) => v !== deleted.value));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = filtered.findIndex((o) => o.id === active.id);
    const newIdx = filtered.findIndex((o) => o.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(filtered, oldIdx, newIdx);
    const filteredIds = new Set(reordered.map((o) => o.id));
    const newOptions: NotePropertyOption[] = [];
    let i = 0;
    for (const opt of options) {
      if (filteredIds.has(opt.id)) newOptions.push(reordered[i++]);
      else newOptions.push(opt);
    }
    onPropChange?.({ ...prop, options: newOptions });
  };

  const style = { ...FLOATING_STYLE_BASE, left: position.x, top: position.y, width: size.width, minHeight: size.minHeight };

  return (
    <div ref={ref} style={style} className="bg-popover text-popover-foreground flex flex-col rounded-md border shadow-md">
      <input ref={inputRef} type="hidden" value={JSON.stringify(selected)} readOnly />
      <div className="border-b p-2">
        <Input autoFocus placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-7 text-xs" />
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map((o) => o.id)} strategy={verticalListSortingStrategy}>
            {filtered.map((option) => {
              const checked = selectedSet.has(option.value);
              return (
                <MultiSortableRow
                  key={option.id}
                  option={option}
                  checked={checked}
                  onToggle={() => toggle(option.value)}
                  onUpdate={(patch) => updateOption(option.id, patch)}
                  onDelete={() => deleteOption(option.id)}
                  isMenuOpen={openOptionMenuId === option.id}
                  onMenuOpenChange={(open) => setOpenOptionMenuId(open ? option.id : null)}
                />
              );
            })}
          </SortableContext>
        </DndContext>
        {filtered.length === 0 && !showCreate && <p className="text-muted-foreground/60 px-1 py-2 text-center text-xs">No matches</p>}
        {showCreate && (
          <button
            type="button"
            onClick={() => createOption(query)}
            className="hover:bg-accent/60 text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs"
          >
            <Plus size={12} />
            <span>
              Create <span className="font-medium">{query.trim()}</span>
            </span>
          </button>
        )}
      </div>
      <div className="border-t p-1">
        <button
          type="button"
          onClick={addOption}
          className="hover:bg-accent text-muted-foreground hover:text-foreground flex h-7 w-full items-center justify-start gap-2 rounded px-2 text-xs"
        >
          <Plus size={12} /> Add option
        </button>
      </div>
    </div>
  );
}

function MultiSortableRow({
  option,
  checked,
  onToggle,
  onUpdate,
  onDelete,
  isMenuOpen,
  onMenuOpenChange,
}: {
  option: NotePropertyOption;
  checked: boolean;
  onToggle: () => void;
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
      className={cn("flex items-center gap-1.5 rounded px-1 py-1 text-xs", checked ? "bg-accent" : "hover:bg-accent/60", isDragging && "bg-accent/60")}
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
          onToggle();
        }}
        className="flex flex-1 items-center gap-1.5"
      >
        <input type="checkbox" checked={checked} readOnly className="h-3.5 w-3.5 accent-primary" />
        <Badge option={option} />
      </button>
      <MultiOptionMenuButton option={option} onUpdate={onUpdate} onDelete={onDelete} isOpen={isMenuOpen} onOpenChange={onMenuOpenChange} />
    </div>
  );
}

function MultiOptionMenuButton({
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
        <MultiOptionEditor option={option} onUpdate={onUpdate} onDelete={onDelete} />
      </PopoverContent>
    </Popover>
  );
}

function MultiOptionEditor({
  option,
  onUpdate,
  onDelete,
}: {
  option: NotePropertyOption;
  onUpdate: (patch: Partial<NotePropertyOption>) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(option.label ?? option.value);

  useEffect(() => {
    setLabel(option.label ?? option.value);
  }, [option.label, option.value]);

  const commit = () => {
    const trimmed = label.trim();
    const currentLabel = option.label ?? option.value;
    if (trimmed && trimmed !== currentLabel) {
      // Keep `value` stable across label edits so cells referencing this option
      // don't appear empty after a rename.
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
