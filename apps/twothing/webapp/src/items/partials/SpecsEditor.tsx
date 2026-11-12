import { Plus, X } from "lucide-react";
import type { SpecRow } from "../hooks/useItemEditor";

export function SpecsEditor({ rows, onChange, onAdd, onRemove }: { rows: SpecRow[]; onChange: (i: number, r: SpecRow) => void; onAdd: () => void; onRemove: (i: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="overflow-hidden rounded-xl border border-outline bg-paper">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center border-b border-outline last:border-b-0">
            <input
              value={r.key}
              onChange={(e) => onChange(i, { ...r, key: e.target.value })}
              placeholder="Property"
              className="h-10 w-[38%] min-w-0 border-r border-outline bg-stone/40 px-3 text-[13px] font-semibold outline-none placeholder:font-normal placeholder:text-ink-muted"
            />
            <input value={r.value} onChange={(e) => onChange(i, { ...r, value: e.target.value })} placeholder="—" className="h-10 min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none placeholder:text-ink-muted/60" />
            <button type="button" aria-label="Remove row" onClick={() => onRemove(i)} className="mr-1 rounded-full p-1.5 text-ink-muted hover:bg-stone hover:text-ink">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink">
        <Plus className="size-3.5" /> Add property
      </button>
    </div>
  );
}
