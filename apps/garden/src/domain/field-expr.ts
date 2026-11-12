import { sql } from "@twodb/core-data/db";
import type { RawBuilder } from "kysely";
import { columnRef, tableRef } from "./dynamic-table.js";
import { asBool, asNumber, asText, compileFormula, FormulaError, type Compiled } from "./formula.js";
import type { FieldCatalog, FieldDef } from "./field-def.js";

// ---------------------------------------------------------------------------
// Field → SQL expression. Aliases: `r` = database_record row, `s` = the
// database's dynamic table row (LEFT JOINed). Rollups open nested aliases.
//
//  mode "raw"     — stored value (select = option id) → filters, sorts, values
//  mode "display" — human value (select = option name) → formulas, rollups
// ---------------------------------------------------------------------------

export interface ExprCtx {
  catalog: FieldCatalog;
  /** alias pair for the current row */
  r: string;
  s: string;
  /** field ids currently being compiled (cycle detection) */
  stack: string[];
  depth: number;
}

export const rootCtx = (catalog: FieldCatalog): ExprCtx => ({ catalog, r: "r", s: "s", stack: [], depth: 0 });

const MAX_DEPTH = 3;

function optionNameExpr(f: FieldDef, value: RawBuilder<unknown>): RawBuilder<unknown> {
  const opts = f.config.options ?? [];
  if (!opts.length) return sql`null::text`;
  const whens = sql.join(
    opts.map((o) => sql`when ${o.id}::text then ${o.name}::text`),
    sql` `,
  );
  return sql`(case ${value} ${whens} end)`;
}

/** Relation ids, minus records in trash. */
function liveRelation(col: RawBuilder<unknown>): RawBuilder<unknown> {
  return sql`array(select x from unnest(${col}) as x where exists (select 1 from database_record d where d.id = x and d.deleted_at is null))`;
}

export function fieldExpr(f: FieldDef, ctx: ExprCtx, mode: "raw" | "display" = "raw"): Compiled {
  const r = sql.raw(ctx.r);
  switch (f.type) {
    case "title":
      return { sql: sql`${r}.title`, type: "text" };
    case "created_time":
      return { sql: sql`${r}.created_at`, type: "date" };
    case "updated_time":
      return { sql: sql`${r}.updated_at`, type: "date" };
    case "created_by":
      return { sql: sql`${r}.created_by`, type: "text" };
    case "text":
    case "url":
    case "email":
    case "phone":
      return { sql: columnRef(f.id, ctx.s), type: "text" };
    case "number":
      return { sql: columnRef(f.id, ctx.s), type: "number" };
    case "checkbox":
      return mode === "display"
        ? { sql: sql`coalesce(${columnRef(f.id, ctx.s)}, false)`, type: "boolean" }
        : { sql: columnRef(f.id, ctx.s), type: "boolean" };
    case "date":
      return { sql: columnRef(f.id, ctx.s), type: "date" };
    case "select":
    case "status":
      return mode === "display" ? { sql: optionNameExpr(f, columnRef(f.id, ctx.s)), type: "text" } : { sql: columnRef(f.id, ctx.s), type: "text" };
    case "multi_select":
      return mode === "display"
        ? { sql: sql`array(select ${optionNameExpr(f, sql`e`)} from unnest(${columnRef(f.id, ctx.s)}) as e)`, type: "array" }
        : { sql: columnRef(f.id, ctx.s), type: "array" };
    case "person":
      return { sql: columnRef(f.id, ctx.s), type: "array" };
    case "relation": {
      const ids = liveRelation(columnRef(f.id, ctx.s));
      if (mode === "display")
        return { sql: sql`array(select d.title from database_record d where d.id = any(${ids}) order by d.title)`, type: "array" };
      return { sql: ids, type: "array" };
    }
    case "rollup":
      return rollupExpr(f, ctx);
    case "formula":
      return formulaExpr(f, ctx);
  }
}

function guard(f: FieldDef, ctx: ExprCtx) {
  if (ctx.stack.includes(f.id)) throw new FormulaError(`Circular reference via "${f.name}"`);
  if (ctx.depth > MAX_DEPTH) throw new FormulaError("Too many nested rollups/formulas");
}

export function formulaExpr(f: FieldDef, ctx: ExprCtx): Compiled {
  guard(f, ctx);
  const fields = ctx.catalog.get(f.databaseId) ?? [];
  const inner: ExprCtx = { ...ctx, stack: [...ctx.stack, f.id], depth: ctx.depth + 1 };
  return compileFormula(f.config.formula?.expression ?? "", (name) => {
    const target = fields.find((x) => x.name === name) ?? fields.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!target) throw new FormulaError(`Unknown property "${name}"`);
    return fieldExpr(target, inner, "display");
  });
}

export function rollupExpr(f: FieldDef, ctx: ExprCtx): Compiled {
  guard(f, ctx);
  const cfg = f.config.rollup;
  const own = ctx.catalog.get(f.databaseId) ?? [];
  const relation = own.find((x) => x.id === cfg?.relationFieldId && x.type === "relation");
  const targetDb = relation?.config.relation?.databaseId;
  const target = targetDb ? (ctx.catalog.get(targetDb) ?? []).find((x) => x.id === cfg?.targetFieldId) : undefined;
  if (!cfg || !relation || !targetDb || !target) throw new FormulaError("Rollup is not configured");

  const n = ctx.depth + 1;
  const inner: ExprCtx = { catalog: ctx.catalog, r: `tr${n}`, s: `tt${n}`, stack: [...ctx.stack, f.id], depth: n };
  const v = fieldExpr(target, inner, cfg.fn === "show_original" ? "display" : "raw");
  const tr = sql.raw(inner.r);
  const tt = sql.raw(inner.s);
  const q = sql`(select ${v.sql} as v from database_record ${tr} left join ${tableRef(targetDb)} ${tt} on ${tt}.record_id = ${tr}.id
    where ${tr}.id = any(${columnRef(relation.id, ctx.s)}) and ${tr}.deleted_at is null)`;
  const val: Compiled = { sql: sql`q.v`, type: v.type };
  const empty = v.type === "array" ? sql`coalesce(cardinality(q.v), 0) = 0` : v.type === "text" ? sql`coalesce(q.v::text, '') = ''` : sql`q.v is null`;
  const agg = (expr: RawBuilder<unknown>, type: Compiled["type"]): Compiled => ({ sql: sql`(select ${expr} from ${q} q)`, type });

  switch (cfg.fn) {
    case "show_original":
      if (v.type === "array") return { sql: sql`(select array_agg(e) from ${q} q, unnest(q.v) e)`, type: "array" };
      return agg(sql`array_agg(${asText(val)}) filter (where q.v is not null)`, "array");
    case "count":
      return agg(sql`count(*)::double precision`, "number");
    case "count_values":
      return v.type === "array" ? agg(sql`coalesce(sum(cardinality(q.v)), 0)::double precision`, "number") : agg(sql`count(q.v)::double precision`, "number");
    case "count_unique":
      return v.type === "array"
        ? { sql: sql`(select count(distinct e)::double precision from ${q} q, unnest(q.v) e)`, type: "number" }
        : agg(sql`count(distinct q.v)::double precision`, "number");
    case "count_empty":
      return agg(sql`count(*) filter (where ${empty})::double precision`, "number");
    case "count_not_empty":
      return agg(sql`count(*) filter (where not (${empty}))::double precision`, "number");
    case "percent_empty":
      return agg(sql`round(100.0 * count(*) filter (where ${empty}) / nullif(count(*), 0), 1)::double precision`, "number");
    case "percent_not_empty":
      return agg(sql`round(100.0 * count(*) filter (where not (${empty})) / nullif(count(*), 0), 1)::double precision`, "number");
    case "sum":
      return agg(sql`sum(${asNumber(val)})`, "number");
    case "average":
      return agg(sql`avg(${asNumber(val)})`, "number");
    case "min":
      return agg(sql`min(${asNumber(val)})`, "number");
    case "max":
      return agg(sql`max(${asNumber(val)})`, "number");
    case "range":
      return agg(sql`(max(${asNumber(val)}) - min(${asNumber(val)}))`, "number");
    case "checked":
      return agg(sql`count(*) filter (where ${asBool(val)})::double precision`, "number");
    case "unchecked":
      return agg(sql`count(*) filter (where not ${asBool(val)})::double precision`, "number");
    case "percent_checked":
      return agg(sql`round(100.0 * count(*) filter (where ${asBool(val)}) / nullif(count(*), 0), 1)::double precision`, "number");
    case "earliest":
      return agg(v.type === "date" ? sql`min(q.v)` : sql`null::timestamptz`, "date");
    case "latest":
      return agg(v.type === "date" ? sql`max(q.v)` : sql`null::timestamptz`, "date");
  }
}

/** Compiles a field, turning config errors into a NULL column + message. */
export function safeFieldExpr(f: FieldDef, ctx: ExprCtx): Compiled & { error: string | null } {
  try {
    return { ...fieldExpr(f, ctx), error: null };
  } catch (err) {
    if (err instanceof FormulaError) return { sql: sql`null`, type: "unknown", error: err.message };
    throw err;
  }
}
