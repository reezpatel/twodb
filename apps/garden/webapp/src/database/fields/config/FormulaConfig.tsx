import { useState } from "react";
import type { Field, FieldConfig } from "@shared/model";

const FUNCS = "if, empty, concat, join, length, lower, upper, trim, contains, replace, slice, format, toNumber, abs, round, ceil, floor, sqrt, pow, min, max, now, today, year, month, day, dateAdd, dateSubtract, dateBetween, formatDate";

export function FormulaConfig({ field, fields, onSave }: { field: Field; fields: Field[]; onSave: (config: FieldConfig) => void }) {
  const [expr, setExpr] = useState(field.config.formula?.expression ?? "");
  const dirty = expr !== (field.config.formula?.expression ?? "");
  const insert = (s: string) => setExpr((e) => (e ? `${e} ${s}` : s));
  return (
    <div className="space-y-2 px-2 py-2">
      <textarea
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        rows={3}
        spellCheck={false}
        placeholder='prop("Price") * prop("Qty")'
        className="w-full resize-y rounded-md border border-outline bg-paper px-2 py-1.5 font-mono text-[12.5px] outline-none focus:border-ion-deep"
      />
      {field.error && !dirty ? <p className="text-[12px] text-destructive">{field.error}</p> : null}
      <div className="flex flex-wrap gap-1">
        {fields
          .filter((f) => f.id !== field.id)
          .map((f) => (
            <button key={f.id} type="button" onClick={() => insert(`prop("${f.name}")`)} className="rounded bg-ink/[0.05] px-1.5 py-0.5 text-[11.5px] hover:bg-ink/[0.1]">
              {f.name}
            </button>
          ))}
      </div>
      <p className="text-[11px] leading-snug text-ink-muted">Functions: {FUNCS}. Operators: + - * / % ^ == != &gt; &lt; and or not.</p>
      <button
        type="button"
        disabled={!dirty}
        onClick={() => onSave({ ...field.config, formula: { expression: expr } })}
        className="h-7 w-full rounded-md bg-ink text-[13px] font-semibold text-paper disabled:opacity-40"
      >
        Save formula
      </button>
    </div>
  );
}
