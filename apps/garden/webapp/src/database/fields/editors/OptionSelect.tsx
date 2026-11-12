import { useState } from "react";
import { Check, Plus } from "lucide-react";
import type { Field, SelectOption } from "@shared/model";
import { OPTION_COLORS } from "@shared/model";
import { OptionPill } from "../OptionPill";
import { useGarden } from "../../../lib/queries";
import { newId } from "../../../lib/format";

/** Notion-style option picker: type to filter, Enter to create, click to toggle. */
export function OptionSelect({ field, value, onChange, multi }: { field: Field; value: unknown; onChange: (v: unknown) => void; multi: boolean }) {
  const garden = useGarden();
  const [q, setQ] = useState("");
  const options = field.config.options ?? [];
  const selected: string[] = multi ? ((value as string[] | null) ?? []) : value ? [value as string] : [];
  const filtered = options.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()));
  const exact = options.some((o) => o.name.toLowerCase() === q.trim().toLowerCase());

  const toggle = (id: string) => {
    if (multi) onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    else onChange(selected[0] === id ? null : id);
    setQ("");
  };

  const create = async () => {
    const name = q.trim();
    if (!name) return;
    const option: SelectOption = { id: newId(), name, color: OPTION_COLORS[(options.length + 1) % OPTION_COLORS.length], ...(field.type === "status" ? { group: "todo" as const } : {}) };
    await garden.patchField(field.id, { config: { ...field.config, options: [...options, option] } });
    toggle(option.id);
  };

  const groups = field.type === "status" ? (["todo", "in_progress", "complete"] as const) : [null];
  const groupLabel = { todo: "To-do", in_progress: "In progress", complete: "Complete" };

  return (
    <div className="w-[260px]">
      <div className="flex min-h-9 flex-wrap items-center gap-1 border-b border-outline px-2 py-1.5">
        {selected.map((id) => {
          const o = options.find((x) => x.id === id);
          return o ? <OptionPill key={id} option={o} onRemove={() => toggle(id)} /> : null;
        })}
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const first = filtered[0];
              if (q.trim() && !exact) void create();
              else if (first) toggle(first.id);
            }
            if (e.key === "Backspace" && !q && selected.length) toggle(selected[selected.length - 1]);
          }}
          placeholder={selected.length ? "" : "Search or create…"}
          className="h-6 min-w-[60px] flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-muted"
        />
      </div>
      <div className="max-h-[260px] overflow-y-auto p-1">
        {groups.map((g) => {
          const list = g ? filtered.filter((o) => (o.group ?? "todo") === g) : filtered;
          if (g && !list.length) return null;
          return (
            <div key={g ?? "all"}>
              {g ? <div className="px-2 pb-0.5 pt-1.5 text-[11px] font-semibold text-ink-muted">{groupLabel[g]}</div> : null}
              {list.map((o) => (
                <button key={o.id} type="button" onClick={() => toggle(o.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 hover:bg-ink/[0.06]">
                  <OptionPill option={o} />
                  <span className="flex-1" />
                  {selected.includes(o.id) ? <Check size={14} className="text-ink-muted" /> : null}
                </button>
              ))}
            </div>
          );
        })}
        {q.trim() && !exact ? (
          <button type="button" onClick={() => void create()} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-ink/[0.06]">
            <Plus size={14} className="text-ink-muted" /> Create <OptionPill option={{ name: q.trim(), color: OPTION_COLORS[(options.length + 1) % OPTION_COLORS.length] }} />
          </button>
        ) : null}
        {!filtered.length && !q.trim() ? <div className="px-2 py-1.5 text-[13px] text-ink-muted">Type to create an option</div> : null}
      </div>
    </div>
  );
}
