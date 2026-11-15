/** snake_case rows <-> camelCase API objects. */
export const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
export const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

const pad = (n: number) => String(n).padStart(2, "0");

/** pg returns numeric as string; these columns are always numbers in the API. */
const NUMERIC = new Set([
  "opening_balance", "credit_limit", "amount", "target", "monthly_fill", "target_amount", "quantity", "avg_cost", "current_price",
  "principal", "current_value", "interest_rate", "installment", "price", "fees", "outstanding", "emi", "assets", "liabilities",
  "net_worth", "networth_target", "inflation", "pre_return", "post_return", "monthly_saving", "step_up", "other_corpus", "monthly_expense",
]);

function mapValue(key: string, v: unknown): unknown {
  if (v instanceof Date) {
    // pg parses `date` columns as local-midnight Dates; timestamptz as instants.
    if (key === "date" || key.endsWith("_date")) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
    return v.toISOString();
  }
  if (typeof v === "string" && NUMERIC.has(key)) {
    const n = Number(v);
    return Number.isNaN(n) ? v : n;
  }
  return v;
}

export function toApi<T extends object = Record<string, any>>(row: Record<string, any> | undefined | null): T {
  if (!row) return row as any;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) out[camel(k)] = mapValue(k, v);
  return out as T;
}

export const toApiList = <T extends object = Record<string, any>>(rows: Record<string, any>[]): T[] => rows.map((r) => toApi<T>(r));

export const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
export const round2 = (n: number) => Math.round(n * 100) / 100;
