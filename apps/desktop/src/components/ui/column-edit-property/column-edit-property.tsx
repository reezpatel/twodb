import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, randomId } from "@/lib/utils";
import {
  SELECTABLE_PROPERTY_TYPES,
  type NoteProperty,
  type NotePropertyOption,
  type NotePropertyType,
  type NotesViewHook,
} from "@/routes/notes/view/use-notes-view";

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

/**
 * Full editor for a single property column: name, type, options (for select),
 * delete. Saves via the existing mutations on the `view` hook so the change
 * persists into the group's metadata.
 */
export function ColumnEditProperty({ prop, view, onClose }: { prop: NoteProperty; view: NotesViewHook; onClose?: () => void }) {
  const [name, setName] = useState(prop.name);
  const [type, setType] = useState(prop.type);
  const [options, setOptions] = useState<NotePropertyOption[]>(prop.options ?? []);

  // Keep local state in sync with the latest prop (after the parent's mutations
  // refetch and the prop arrives with the new field's value).
  useEffect(() => {
    setName(prop.name);
    setType(prop.type);
    setOptions(prop.options ?? []);
  }, [prop.name, prop.type, prop.options]);

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== prop.name) {
      view.renameProperty.mutate({ id: prop.id, name: trimmed });
    }
  };

  const handleTypeChange = (newType: NotePropertyType) => {
    setType(newType);
    if (newType !== prop.type) {
      view.setPropertyType.mutate({ id: prop.id, type: newType });
    }
  };

  const commitOptions = (newOptions: NotePropertyOption[]) => {
    setOptions(newOptions);
    view.setPropertyOptions.mutate({ id: prop.id, options: newOptions });
  };

  const addOption = () => {
    const newOption: NotePropertyOption = {
      id: randomId(),
      value: "New option",
      label: "New option",
      color: OPTION_COLORS[options.length % OPTION_COLORS.length],
    };
    commitOptions([...options, newOption]);
  };

  const updateOption = (id: string, patch: Partial<NotePropertyOption>) => {
    commitOptions(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const deleteOption = (id: string) => {
    commitOptions(options.filter((o) => o.id !== id));
  };

  const handleDelete = () => {
    if (window.confirm(`Delete property "${prop.name}" and all its values? This cannot be undone.`)) {
      view.deleteProperty.mutate(prop.id);
      onClose?.();
    }
  };

  return (
    <div className="flex w-80 flex-col gap-4 p-3">
      <div>
        <label className="text-muted-foreground/70 mb-1 block text-[10px] font-semibold tracking-wide uppercase">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitName();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          className="h-7 text-xs"
          autoFocus
        />
      </div>
      <div>
        <label className="text-muted-foreground/70 mb-1 block text-[10px] font-semibold tracking-wide uppercase">Type</label>
        <select
          className="border-input bg-background h-7 w-full rounded-md border px-2 text-xs"
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as NotePropertyType)}
        >
          {SELECTABLE_PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      {(type === "select" || type === "multiselect" || type === "status") && (
        <div>
          <label className="text-muted-foreground/70 mb-1 block text-[10px] font-semibold tracking-wide uppercase">Options</label>
          <div className="space-y-1">
            {options.map((option) => (
              <OptionRow
                key={option.id}
                option={option}
                isStatus={type === "status"}
                onUpdate={(patch) => updateOption(option.id, patch)}
                onDelete={() => deleteOption(option.id)}
              />
            ))}
          </div>
          <Button variant="ghost" size="sm" className="h-7 mt-1 w-full justify-start text-xs" onClick={addOption}>
            <Plus size={12} /> Add option
          </Button>
        </div>
      )}
      <div className="border-t pt-3">
        <Button variant="destructive" size="sm" className="h-7 w-full text-xs" onClick={handleDelete}>
          <Trash2 size={12} /> Delete property
        </Button>
      </div>
    </div>
  );
}

function OptionRow({
  option,
  isStatus,
  onUpdate,
  onDelete,
}: {
  option: NotePropertyOption;
  isStatus?: boolean;
  onUpdate: (patch: Partial<NotePropertyOption>) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(option.label ?? option.value);
  const [group, setGroup] = useState(option.group ?? "");

  useEffect(() => {
    setLabel(option.label ?? option.value);
    setGroup(option.group ?? "");
  }, [option.label, option.value, option.group]);

  const commitLabel = () => {
    const trimmed = label.trim();
    const currentLabel = option.label ?? option.value;
    if (trimmed && trimmed !== currentLabel) {
      // Keep `value` stable so cells referencing this option don't appear
      // empty after a rename. value is set at creation and never changes
      // through label edits.
      onUpdate({ label: trimmed });
    }
  };

  const commitGroup = () => {
    const trimmed = group.trim();
    const currentGroup = option.group ?? "";
    if (trimmed !== currentGroup) {
      onUpdate({ group: trimmed || undefined });
    }
  };

  const cycleColor = () => {
    const idx = OPTION_COLORS.indexOf(option.color ?? DEFAULT_OPTION_COLOR);
    const next = OPTION_COLORS[(idx === -1 ? 0 : idx + 1) % OPTION_COLORS.length];
    onUpdate({ color: next });
  };

  return (
    <div className="border-input bg-background flex flex-col gap-1 rounded-md border px-1.5 py-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={cycleColor}
          className={cn("border-foreground/40 hover:border-foreground h-4 w-5 shrink-0 rounded border-2 transition-colors")}
          style={{ backgroundColor: option.color ?? DEFAULT_OPTION_COLOR }}
          aria-label="Color"
          title="Click to cycle color"
        />
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitLabel();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          className="h-6 min-w-0 flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive h-6 w-6 shrink-0"
          onClick={onDelete}
          title="Delete option"
        >
          <X size={12} />
        </Button>
      </div>
      {isStatus && (
        <Input
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          onBlur={commitGroup}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitGroup();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          placeholder="Group (e.g. Backlog)"
          className="h-5 w-full border-0 bg-transparent px-1 text-[11px] text-muted-foreground/80 italic shadow-none focus-visible:ring-0"
        />
      )}
    </div>
  );
}
