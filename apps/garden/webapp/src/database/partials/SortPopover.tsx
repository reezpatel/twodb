import { Plus, Trash2 } from "lucide-react";
import type { Field, SortSpec } from "@shared/model";

const sel = "h-7 min-w-0 rounded-md border border-outline bg-paper px-1.5 text-[13px] outline-none focus:border-ion-deep";

export function SortPopover({ fields, sorts, onSave }: { fields: Field[]; sorts: SortSpec[]; onSave: (s: SortSpec[]) => void }) {
  const set = (i: number, s: SortSpec | null) => onSave(s ? sorts.map((x, j) => (j === i ? s : x)) : sorts.filter((_, j) => j !== i));
  const unused = fields.filter((f) => !sorts.some((s) => s.fieldId === f.id));
  return (
    <div className="w-[340px] p-2">
      {sorts.length === 0 ? <div className="px-1 py-1.5 text-[13px] text-ink-muted">No sorts applied</div> : null}
      {sorts.map((s, i) => (
        <div key={`${s.fieldId}-${i}`} className="flex items-center gap-1.5 py-1">
          <select className={`${sel} flex-1`} value={s.fieldId} onChange={(e) => set(i, { ...s, fieldId: e.target.value })}>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <select className={`${sel} w-[120px]`} value={s.direction} onChange={(e) => set(i, { ...s, direction: e.target.value as "asc" | "desc" })}>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
          <button type="button" onClick={() => set(i, null)} className="text-ink-muted hover:text-destructive" aria-label="Remove sort">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      {unused.length ? (
        <button type="button" onClick={() => onSave([...sorts, { fieldId: unused[0].id, direction: "asc" }])} className="mt-1 flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-ink-muted hover:bg-ink/[0.06] hover:text-ink">
          <Plus size={14} /> Add sort
        </button>
      ) : null}
    </div>
  );
}
