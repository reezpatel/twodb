import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@twodb/blocks";
import type { DatabaseViewModel } from "../hooks/useDatabaseView";
import type { RowGroup } from "../lib/view-utils";
import { RowCard } from "../partials/RowCard";
import { OptionPill } from "../fields/OptionPill";
import { GroupPopover } from "../partials/GroupPopover";

export function KanbanView({ m }: { m: DatabaseViewModel }) {
  const [drag, setDrag] = useState<{ rowId: string; from: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  if (!m.groupField || !m.groups)
    return (
      <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-outline p-6 text-[13.5px] text-ink-muted">
        Kanban groups cards by a property.
        <div className="rounded-lg border border-outline bg-popover">
          <GroupPopover fields={m.fields} groupBy={null} required onSave={(groupBy) => void m.updateConfig({ groupBy })} />
        </div>
      </div>
    );
  const drop = (to: RowGroup) => {
    if (!drag) return;
    const row = m.rows.find((r) => r.id === drag.rowId);
    const from = m.groups!.find((g) => g.key === drag.from);
    if (row) void m.moveToGroup(row, from, to);
    setDrag(null);
    setOver(null);
  };
  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {m.groups.map((g) => (
        <div
          key={g.key}
          onDragOver={(e) => (e.preventDefault(), setOver(g.key))}
          onDragLeave={() => setOver((o) => (o === g.key ? null : o))}
          onDrop={() => drop(g)}
          className={cn("flex w-[264px] shrink-0 flex-col rounded-[10px] p-1.5 transition-colors", over === g.key ? "bg-ion/20" : "bg-ink/[0.025]")}
        >
          <div className="flex h-8 items-center gap-1.5 px-1">
            {g.option ? <OptionPill option={g.option} /> : <span className="text-[13px] font-medium">{g.label}</span>}
            <span className="text-[12px] text-ink-muted">{g.rows.length}</span>
            <button type="button" onClick={() => void m.addRow({ [m.groupField!.id]: g.value }, { open: true })} className="ml-auto flex size-6 items-center justify-center rounded text-ink-muted hover:bg-ink/[0.06]" aria-label="Add card">
              <Plus size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {g.rows.map((r) => (
              <RowCard
                key={`${g.key}-${r.id}`}
                row={r}
                fields={m.visible.filter((v) => v.field.id !== m.groupField!.id)}
                relations={m.relations}
                onOpen={() => m.openRow(r.id)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  setDrag({ rowId: r.id, from: g.key });
                }}
                className={drag?.rowId === r.id ? "opacity-50" : undefined}
              />
            ))}
            <button type="button" onClick={() => void m.addRow({ [m.groupField!.id]: g.value }, { open: true })} className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-muted hover:bg-ink/[0.05] hover:text-ink">
              <Plus size={14} /> New
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
