/** snake_case rows <-> camelCase API objects. */
const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function mapValue(key: string, v: unknown): unknown {
  if (v instanceof Date) {
    // pg parses `date` columns as local-midnight Dates; timestamptz as instants.
    if (key.endsWith("_date")) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
    return v.toISOString();
  }
  if (typeof v === "string" && key.startsWith("estimate_") && key !== "estimate_unit") {
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

/** Pick `allowed` camelCase keys that are present (!== undefined) in `input`, returned snake_case. */
export function toColumns(input: Record<string, any>, allowed: readonly string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of allowed) if (input[k] !== undefined) out[snake(k)] = input[k];
  return out;
}
