import { Plus, X } from "lucide-react";

export type HeaderRow = { key: string; value: string };

export const rowsOf = (h: Record<string, string>): HeaderRow[] => Object.entries(h).map(([key, value]) => ({ key, value }));

/** Rows → object; blank keys are dropped. */
export const headersOf = (rows: HeaderRow[]): Record<string, string> =>
  Object.fromEntries(rows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value]));

const field = "h-8 min-w-0 rounded-md bg-surface-muted px-2 font-mono text-[12px] outline-none placeholder:text-ink-muted/60 focus:ring-1 focus:ring-outline-strong";

/** Key/value rows for request headers. Values may use <ENV_NAME> placeholders. */
export function HeadersEditor({ rows, onChange }: { rows: HeaderRow[]; onChange: (rows: HeaderRow[]) => void }) {
  const set = (i: number, patch: Partial<HeaderRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input value={r.key} onChange={(e) => set(i, { key: e.target.value })} placeholder="Authorization" aria-label="Header name" className={`${field} w-2/5`} />
          <input value={r.value} onChange={(e) => set(i, { value: e.target.value })} placeholder="Bearer <FIRECRAWL_API_KEY>" aria-label="Header value" className={`${field} flex-1`} />
          <button type="button" aria-label="Remove header" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="rounded p-1 text-ink-muted hover:text-destructive">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, { key: "", value: "" }])} className="flex w-fit items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-ink-muted hover:bg-surface-muted hover:text-ink">
        <Plus className="size-3.5" /> Add header
      </button>
    </div>
  );
}
