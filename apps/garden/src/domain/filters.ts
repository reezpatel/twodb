import { sql } from "@twodb/core-data/db";
import type { RawBuilder } from "kysely";
import type { FilterCondition, FilterGroup, FilterNode, SortSpec } from "../shared/model.js";
import { isFilterGroup, VALUELESS_OPERATORS } from "../shared/model.js";
import { asText, type Compiled } from "./formula.js";
import type { FieldDef } from "./field-def.js";
import { safeFieldExpr, type ExprCtx } from "./field-expr.js";

// ---------------------------------------------------------------------------
// View filter tree + sorts → SQL. Incomplete conditions (no field / missing
// value) are ignored, like Notion does while you're still building a filter.
// ---------------------------------------------------------------------------

const RELATIVE_DATES: Record<string, string> = {
  today: "0 days",
  tomorrow: "1 day",
  yesterday: "-1 day",
  one_week_ago: "-7 days",
  one_week_from_now: "7 days",
  one_month_ago: "-1 month",
  one_month_from_now: "1 month",
};

function dateValue(v: unknown): RawBuilder<unknown> | null {
  if (typeof v !== "string" || !v) return null;
  if (RELATIVE_DATES[v]) return sql`(current_date + ${RELATIVE_DATES[v]}::interval)::date`;
  if (Number.isNaN(Date.parse(v))) return null;
  return sql`(${v.slice(0, 10)})::date`;
}

const arr = (v: unknown): string[] | null => {
  const a = Array.isArray(v) ? v : typeof v === "string" && v ? [v] : [];
  const out = a.filter((x): x is string => typeof x === "string" && x.length > 0);
  return out.length ? out : null;
};

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

function condition(field: FieldDef, e: Compiled, c: FilterCondition): RawBuilder<unknown> | null {
  const op = c.operator;
  const v = c.value;
  const needsValue = !VALUELESS_OPERATORS.has(op);
  if (needsValue && (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0))) return null;

  const isArray = e.type === "array";
  const empty = isArray ? sql`coalesce(cardinality(${e.sql}), 0) = 0` : e.type === "text" ? sql`coalesce(${e.sql}, '') = ''` : sql`(${e.sql}) is null`;

  switch (op) {
    case "is_empty":
      return sql`(${empty})`;
    case "is_not_empty":
      return sql`(not (${empty}))`;
    case "is_checked":
      return sql`((${e.sql}) is true)`;
    case "is_unchecked":
      return sql`((${e.sql}) is not true)`;
  }

  if (e.type === "date") {
    const d = dateValue(v);
    if (!d) return null;
    const day = sql`((${e.sql}) at time zone 'UTC')::date`;
    switch (op) {
      case "is":
        return sql`(${day} = ${d})`;
      case "before":
        return sql`(${day} < ${d})`;
      case "after":
        return sql`(${day} > ${d})`;
      case "on_or_before":
        return sql`(${day} <= ${d})`;
      case "on_or_after":
        return sql`(${day} >= ${d})`;
      default:
        return null;
    }
  }

  if (e.type === "number") {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    const ops: Record<string, string> = { eq: "=", is: "=", neq: "<>", is_not: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" };
    if (!ops[op]) return null;
    return sql`((${e.sql}) ${sql.raw(ops[op])} ${n}::double precision)`;
  }

  // Option / multi-value semantics.
  if (isArray || field.type === "select" || field.type === "status" || field.type === "created_by") {
    const ids = arr(v);
    if (!ids) return null;
    const asArr = isArray ? sql`coalesce((${e.sql})::text[], '{}')` : sql`array_remove(array[(${e.sql})::text], null)`;
    switch (op) {
      case "is":
      case "has_any":
        return sql`(${asArr} && ${ids}::text[])`;
      case "has_all":
        return sql`(${asArr} @> ${ids}::text[])`;
      case "is_not":
      case "has_none":
        return sql`(not (${asArr} && ${ids}::text[]))`;
      case "contains":
        if (!isArray) break;
        return sql`(array_to_string(${asArr}, ' ') ilike ${`%${likeEscape(String(ids[0]))}%`})`;
      default:
        return null;
    }
  }

  const t = asText(e);
  const s = String(v);
  switch (op) {
    case "is":
      return sql`(lower(coalesce(${t}, '')) = lower(${s}))`;
    case "is_not":
      return sql`(lower(coalesce(${t}, '')) <> lower(${s}))`;
    case "contains":
      return sql`(coalesce(${t}, '') ilike ${`%${likeEscape(s)}%`})`;
    case "not_contains":
      return sql`(coalesce(${t}, '') not ilike ${`%${likeEscape(s)}%`})`;
    case "starts_with":
      return sql`(coalesce(${t}, '') ilike ${`${likeEscape(s)}%`})`;
    case "ends_with":
      return sql`(coalesce(${t}, '') ilike ${`%${likeEscape(s)}`})`;
    default:
      return null;
  }
}

export function compileFilter(node: FilterNode | null | undefined, fields: FieldDef[], ctx: ExprCtx): RawBuilder<unknown> | null {
  if (!node) return null;
  if (isFilterGroup(node)) return compileGroup(node, fields, ctx);
  const field = fields.find((f) => f.id === node.fieldId);
  if (!field) return null;
  const e = safeFieldExpr(field, ctx);
  if (e.error) return null;
  return condition(field, e, node);
}

function compileGroup(g: FilterGroup, fields: FieldDef[], ctx: ExprCtx): RawBuilder<unknown> | null {
  const parts = g.conditions.map((c) => compileFilter(c, fields, ctx)).filter((p): p is RawBuilder<unknown> => p !== null);
  if (!parts.length) return null;
  return sql`(${sql.join(parts, g.conjunction === "or" ? sql` or ` : sql` and `)})`;
}

export function compileSorts(sorts: SortSpec[] | undefined, fields: FieldDef[], ctx: ExprCtx): RawBuilder<unknown>[] {
  const out: RawBuilder<unknown>[] = [];
  for (const s of sorts ?? []) {
    const field = fields.find((f) => f.id === s.fieldId);
    if (!field) continue;
    const e = safeFieldExpr(field, ctx);
    if (e.error) continue;
    const dir = sql.raw(s.direction === "desc" ? "desc" : "asc");
    let key: RawBuilder<unknown>;
    if ((field.type === "select" || field.type === "status" || field.type === "multi_select") && field.config.options?.length) {
      const ids = field.config.options.map((o) => o.id);
      const first = field.type === "multi_select" ? sql`(${e.sql})[1]` : e.sql;
      key = sql`array_position(${ids}::text[], ${first})`;
    } else if (field.type === "relation") {
      key = sql`(select min(d.title) from database_record d where d.id = any(${e.sql}))`;
    } else if (e.type === "array") {
      key = sql`array_to_string((${e.sql})::text[], ',')`;
    } else if (e.type === "text") {
      key = sql`lower(${e.sql})`;
    } else {
      key = e.sql;
    }
    out.push(sql`${key} ${dir} nulls last`);
  }
  return out;
}
