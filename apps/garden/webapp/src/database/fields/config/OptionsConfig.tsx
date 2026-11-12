import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Field, OptionColor, SelectOption } from "@shared/model";
import { OPTION_COLORS } from "@shared/model";
import { OPTION_BG, OPTION_DOT, newId } from "../../../lib/format";
import { Popover } from "../../../ui/Popover";

/** Edit option names/colors (and status groups); deletion clears the option from rows server-side. */
export function OptionsConfig({ field, onSave }: { field: Field; onSave: (options: SelectOption[]) => void }) {
  const options = field.config.options ?? [];
  const [draft, setDraft] = useState("");
  const update = (id: string, patch: Partial<SelectOption>) => onSave(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const add = () => {
    const name = draft.trim();
    if (!name || options.some((o) => o.name.toLowerCase() === name.toLowerCase())) return;
    onSave([...options, { id: newId(), name, color: OPTION_COLORS[(options.length + 1) % OPTION_COLORS.length], ...(field.type === "status" ? { group: "todo" as const } : {}) }]);
    setDraft("");
  };
  return (
    <div className="px-1">
      <div className="px-1 pb-1 pt-2 text-[11.5px] font-semibold text-ink-muted">Options</div>
      {options.map((o) => (
        <div key={o.id} className="group flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-ink/[0.04]">
          <Popover
            trigger={
              <button type="button" className="size-4 shrink-0 rounded-[4px] border border-outline" style={{ background: OPTION_BG[o.color] }} aria-label="Color" />
            }
          >
            <div className="grid grid-cols-3 gap-1 p-2">
              {OPTION_COLORS.map((c: OptionColor) => (
                <button key={c} type="button" onClick={() => update(o.id, { color: c })} className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs capitalize hover:bg-ink/[0.06]">
                  <span className="size-3 rounded-full" style={{ background: OPTION_DOT[c] }} /> {c}
                </button>
              ))}
            </div>
          </Popover>
          <input
            defaultValue={o.name}
            onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== o.name && update(o.id, { name: e.target.value.trim() })}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="h-6 min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
          {field.type === "status" ? (
            <select value={o.group ?? "todo"} onChange={(e) => update(o.id, { group: e.target.value as SelectOption["group"] })} className="h-6 rounded bg-transparent text-[11px] text-ink-muted outline-none">
              <option value="todo">To-do</option>
              <option value="in_progress">In progress</option>
              <option value="complete">Complete</option>
            </select>
          ) : null}
          <button type="button" onClick={() => onSave(options.filter((x) => x.id !== o.id))} className="text-ink-muted opacity-0 hover:text-destructive group-hover:opacity-100" aria-label="Delete option">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1.5 px-1 py-0.5">
        <Plus size={14} className="text-ink-muted" />
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add an option" className="h-6 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-muted" />
      </div>
    </div>
  );
}
