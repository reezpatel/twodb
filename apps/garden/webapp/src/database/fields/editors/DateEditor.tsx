import type { Field } from "@shared/model";
import { dayKey } from "../../../lib/format";

/** Native date(/time) input + quick picks. Values are ISO strings. */
export function DateEditor({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const withTime = !!field.config.date?.includeTime;
  const d = typeof value === "string" && value ? new Date(value) : null;
  const local = d ? (withTime ? `${dayKey(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : dayKey(d)) : "";
  const set = (s: string) => {
    if (!s) return onChange(null);
    const parsed = withTime ? new Date(s) : new Date(`${s}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) onChange(parsed.toISOString());
  };
  const quick = (offset: number) => {
    const t = new Date();
    t.setDate(t.getDate() + offset);
    t.setHours(12, 0, 0, 0);
    onChange(t.toISOString());
  };
  return (
    <div className="w-[250px] p-2">
      <input
        autoFocus
        type={withTime ? "datetime-local" : "date"}
        value={local}
        onChange={(e) => set(e.target.value)}
        className="h-8 w-full rounded-md border border-outline bg-paper px-2 text-[13px] outline-none focus:border-ion-deep"
      />
      <div className="mt-2 flex flex-wrap gap-1">
        {[
          ["Today", 0],
          ["Tomorrow", 1],
          ["Next week", 7],
        ].map(([l, o]) => (
          <button key={l} type="button" onClick={() => quick(o as number)} className="rounded-md bg-ink/[0.05] px-2 py-1 text-xs hover:bg-ink/[0.1]">
            {l}
          </button>
        ))}
        {d ? (
          <button type="button" onClick={() => onChange(null)} className="ml-auto rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-ink/[0.06]">
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
