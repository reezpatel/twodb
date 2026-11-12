import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, Trash2, FolderPlus } from "lucide-react";
import type { Field, FilterCondition, FilterGroup, FilterNode, FilterOperator } from "@shared/model";
import { isFilterGroup, OPERATOR_LABELS, operatorsFor } from "@shared/model";
import { newId } from "../../lib/format";
import { FieldIcon } from "../fields/fieldMeta";
import { FilterValueInput } from "./FilterValueInput";

const sel = "h-7 min-w-0 rounded-md border border-outline bg-paper px-1.5 text-[13px] outline-none focus:border-ion-deep";

export const emptyGroup = (): FilterGroup => ({ id: newId(), conjunction: "and", conditions: [] });

export function newCondition(field: Field): FilterCondition {
  return { id: newId(), fieldId: field.id, operator: operatorsFor(field)[0] };
}

/** Filter builder (AND/OR, nested groups). Edits locally and persists to the view, debounced. */
export function FilterPopover({ fields, filter, onSave, footer }: { fields: Field[]; filter: FilterGroup | null | undefined; onSave: (f: FilterGroup | null) => void; footer?: ReactNode }) {
  const [draft, setDraft] = useState<FilterGroup>(filter ?? emptyGroup());
  const pending = useRef<FilterGroup | null>(null);
  const save = useRef(onSave);
  save.current = onSave;
  const flush = () => {
    if (!pending.current) return;
    const g = pending.current;
    pending.current = null;
    save.current(g.conditions.length ? g : null);
  };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const update = (g: FilterGroup) => {
    setDraft(g);
    pending.current = g;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 350);
  };
  // closing the popover unmounts us: never drop an unsaved edit
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      flush();
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="w-[min(560px,92vw)] p-2">
      <GroupEditor group={draft} fields={fields} onChange={update} depth={0} />
      {footer}
    </div>
  );
}

function GroupEditor({ group, fields, onChange, depth, onRemove }: { group: FilterGroup; fields: Field[]; onChange: (g: FilterGroup) => void; depth: number; onRemove?: () => void }) {
  const setNode = (i: number, n: FilterNode | null) => onChange({ ...group, conditions: n ? group.conditions.map((c, j) => (j === i ? n : c)) : group.conditions.filter((_, j) => j !== i) });
  const titleField = fields.find((f) => f.id === "title") ?? fields[0];
  return (
    <div className={depth ? "rounded-md border border-outline bg-ink/[0.02] p-2" : ""}>
      {group.conditions.length === 0 ? <div className="px-1 py-1.5 text-[13px] text-ink-muted">No filters applied to this view</div> : null}
      {group.conditions.map((c, i) => (
        <div key={c.id} className="flex items-start gap-1.5 py-1">
          <div className="w-[60px] shrink-0 pt-1 text-right text-[12.5px] text-ink-muted">
            {i === 0 ? (
              "Where"
            ) : i === 1 ? (
              <select className={`${sel} w-full`} value={group.conjunction} onChange={(e) => onChange({ ...group, conjunction: e.target.value as "and" | "or" })}>
                <option value="and">and</option>
                <option value="or">or</option>
              </select>
            ) : (
              group.conjunction
            )}
          </div>
          <div className="min-w-0 flex-1">
            {isFilterGroup(c) ? (
              <GroupEditor group={c} fields={fields} depth={depth + 1} onChange={(g) => setNode(i, g)} onRemove={() => setNode(i, null)} />
            ) : (
              <ConditionRow cond={c} fields={fields} onChange={(n) => setNode(i, n)} />
            )}
          </div>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-1">
        <button type="button" onClick={() => titleField && onChange({ ...group, conditions: [...group.conditions, newCondition(titleField)] })} className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-ink-muted hover:bg-ink/[0.06] hover:text-ink">
          <Plus size={14} /> Add filter
        </button>
        {depth < 1 ? (
          <button type="button" onClick={() => onChange({ ...group, conditions: [...group.conditions, emptyGroup()] })} className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-ink-muted hover:bg-ink/[0.06] hover:text-ink">
            <FolderPlus size={14} /> Add group
          </button>
        ) : null}
        {onRemove ? (
          <button type="button" onClick={onRemove} className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-ink-muted hover:text-destructive">
            <Trash2 size={13} /> Remove group
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ConditionRow({ cond, fields, onChange }: { cond: FilterCondition; fields: Field[]; onChange: (c: FilterCondition | null) => void }) {
  const field = fields.find((f) => f.id === cond.fieldId) ?? fields[0];
  if (!field) return null;
  const ops = operatorsFor(field);
  return (
    <div className="flex items-start gap-1.5">
      <div className="relative w-[140px] shrink-0">
        <span className="pointer-events-none absolute left-1.5 top-1.5">
          <FieldIcon type={field.type} size={13} />
        </span>
        <select className={`${sel} w-full pl-6`} value={field.id} onChange={(e) => onChange(newCondition(fields.find((f) => f.id === e.target.value)!))}>
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <select className={`${sel} w-[130px] shrink-0`} value={cond.operator} onChange={(e) => onChange({ ...cond, operator: e.target.value as FilterOperator })}>
        {ops.map((o) => (
          <option key={o} value={o}>
            {OPERATOR_LABELS[o]}
          </option>
        ))}
      </select>
      <div className="min-w-0 flex-1">
        <FilterValueInput key={`${field.id}-${cond.operator}`} field={field} cond={cond} onChange={(value) => onChange({ ...cond, value })} />
      </div>
      <button type="button" onClick={() => onChange(null)} className="mt-1 shrink-0 text-ink-muted hover:text-destructive" aria-label="Remove filter">
        <Trash2 size={14} />
      </button>
    </div>
  );
}
