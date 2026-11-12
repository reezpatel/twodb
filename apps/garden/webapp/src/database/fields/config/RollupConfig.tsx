import type { Field, FieldConfig, RollupFn } from "@shared/model";
import { ROLLUP_FNS } from "@shared/model";
import { useDatabase } from "../../../lib/queries";

const FN_LABELS: Record<RollupFn, string> = {
  show_original: "Show original",
  count: "Count all",
  count_values: "Count values",
  count_unique: "Count unique values",
  count_empty: "Count empty",
  count_not_empty: "Count not empty",
  percent_empty: "Percent empty",
  percent_not_empty: "Percent not empty",
  sum: "Sum",
  average: "Average",
  min: "Min",
  max: "Max",
  range: "Range",
  checked: "Checked",
  unchecked: "Unchecked",
  percent_checked: "Percent checked",
  earliest: "Earliest date",
  latest: "Latest date",
};

const sel = "h-7 w-full rounded-md border border-outline bg-paper px-1.5 text-[13px] outline-none focus:border-ion-deep";

export function RollupConfig({ field, fields, onSave }: { field: Field; fields: Field[]; onSave: (config: FieldConfig) => void }) {
  const cfg = field.config.rollup;
  const relations = fields.filter((f) => f.type === "relation");
  const relation = relations.find((r) => r.id === cfg?.relationFieldId);
  const target = useDatabase(relation?.config.relation?.databaseId);
  const save = (patch: Partial<NonNullable<FieldConfig["rollup"]>>) => {
    const next = { relationFieldId: cfg?.relationFieldId ?? "", targetFieldId: cfg?.targetFieldId ?? "title", fn: cfg?.fn ?? ("show_original" as RollupFn), ...patch };
    if (next.relationFieldId) onSave({ ...field.config, rollup: next });
  };
  if (!relations.length) return <p className="px-2 py-2 text-[12.5px] text-ink-muted">Add a relation property first — rollups aggregate values from related pages.</p>;
  return (
    <div className="space-y-2 px-2 py-2">
      <label className="block text-[11.5px] font-semibold text-ink-muted">
        Relation
        <select className={sel} value={cfg?.relationFieldId ?? ""} onChange={(e) => save({ relationFieldId: e.target.value, targetFieldId: "title" })}>
          <option value="">Select…</option>
          {relations.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[11.5px] font-semibold text-ink-muted">
        Property
        <select className={sel} value={cfg?.targetFieldId ?? ""} disabled={!relation} onChange={(e) => save({ targetFieldId: e.target.value })}>
          {(target.data?.fields ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[11.5px] font-semibold text-ink-muted">
        Calculate
        <select className={sel} value={cfg?.fn ?? "show_original"} disabled={!relation} onChange={(e) => save({ fn: e.target.value as RollupFn })}>
          {ROLLUP_FNS.map((fn) => (
            <option key={fn} value={fn}>
              {FN_LABELS[fn]}
            </option>
          ))}
        </select>
      </label>
      {field.error ? <p className="text-[12px] text-destructive">{field.error}</p> : null}
    </div>
  );
}
