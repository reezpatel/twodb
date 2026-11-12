import type { Field, FilterCondition } from "@shared/model";
import { VALUELESS_OPERATORS } from "@shared/model";
import { Popover } from "../../ui/Popover";
import { OptionSelect } from "../fields/editors/OptionSelect";
import { PersonEditor } from "../fields/editors/PersonEditor";
import { RelationEditor } from "../fields/editors/RelationEditor";
import { CellDisplay } from "../fields/CellDisplay";

const RELATIVE = [
  ["today", "Today"],
  ["tomorrow", "Tomorrow"],
  ["yesterday", "Yesterday"],
  ["one_week_ago", "One week ago"],
  ["one_week_from_now", "One week from now"],
  ["one_month_ago", "One month ago"],
  ["one_month_from_now", "One month from now"],
];

const input = "h-7 w-full min-w-0 rounded-md border border-outline bg-paper px-2 text-[13px] outline-none focus:border-ion-deep";

/** Value editor for a filter condition, by field type. */
export function FilterValueInput({ field, cond, onChange }: { field: Field; cond: FilterCondition; onChange: (v: unknown) => void }) {
  if (VALUELESS_OPERATORS.has(cond.operator)) return null;
  const vt = field.type === "rollup" || field.type === "formula" ? field.valueType : null;
  const arrayValue = Array.isArray(cond.value) ? cond.value : cond.value ? [cond.value] : [];

  if (field.type === "select" || field.type === "status" || field.type === "multi_select" || field.type === "person" || field.type === "relation" || field.type === "created_by") {
    const display = field.type === "created_by" ? { ...field, type: "person" as const } : field;
    return (
      <Popover
        trigger={
          <button type="button" className={`${input} flex items-center overflow-hidden text-left`}>
            {arrayValue.length ? <CellDisplay field={display} value={field.type === "select" || field.type === "status" ? arrayValue[0] : arrayValue} /> : <span className="text-ink-muted">Select…</span>}
          </button>
        }
      >
        {field.type === "person" || field.type === "created_by" ? (
          <PersonEditor value={arrayValue} onChange={onChange} />
        ) : field.type === "relation" ? (
          <RelationEditor field={field} value={arrayValue} onChange={onChange} />
        ) : (
          <OptionSelect field={field} value={arrayValue} onChange={onChange} multi />
        )}
      </Popover>
    );
  }
  if (field.type === "date" || field.type === "created_time" || field.type === "updated_time" || vt === "date") {
    const v = typeof cond.value === "string" ? cond.value : "";
    const relative = RELATIVE.some(([k]) => k === v);
    return (
      <div className="flex gap-1">
        <select className={input} value={relative ? v : "exact"} onChange={(e) => onChange(e.target.value === "exact" ? new Date().toISOString().slice(0, 10) : e.target.value)}>
          {RELATIVE.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
          <option value="exact">Exact date</option>
        </select>
        {!relative ? <input type="date" className={input} value={v.slice(0, 10)} onChange={(e) => onChange(e.target.value)} /> : null}
      </div>
    );
  }
  if (field.type === "number" || vt === "number")
    return <input className={input} inputMode="decimal" defaultValue={cond.value as number | undefined} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} placeholder="Value" />;
  return <input className={input} defaultValue={(cond.value as string) ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Value" />;
}
