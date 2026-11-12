import { sql } from "@twodb/core-data/db";
import type { RawBuilder } from "kysely";
import type { ValueType } from "../shared/model.js";

// ---------------------------------------------------------------------------
// Formula language → SQL compiler.
//
//   prop("Price") * prop("Qty")
//   if(prop("Done"), "✓", "pending")
//   dateBetween(now(), prop("Due"), "days") > 3 and not empty(prop("Owner"))
//
// Every literal becomes a typed bind parameter; identifiers never reach SQL
// raw, so a formula cannot inject SQL. The result is an expression usable in
// SELECT / WHERE / ORDER BY exactly like a physical column.
// ---------------------------------------------------------------------------

export interface Compiled {
  sql: RawBuilder<unknown>;
  type: ValueType;
}

export type PropResolver = (name: string) => Compiled;

export class FormulaError extends Error {}

// --- tokenizer -------------------------------------------------------------

type Tok =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "eof" };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new FormulaError(`Unexpected "${c}"`);
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\" && j + 1 < src.length) {
          s += src[j + 1];
          j += 2;
        } else s += src[j++];
      }
      if (j >= src.length) throw new FormulaError("Unterminated string");
      out.push({ t: "str", v: s });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      out.push({ t: "id", v: m[0] });
      i += m[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["==", "!=", ">=", "<=", "&&", "||"].includes(two)) {
      out.push({ t: "op", v: two });
      i += 2;
      continue;
    }
    if ("+-*/%^()<>,!=".includes(c)) {
      out.push({ t: "op", v: c === "=" ? "==" : c });
      i++;
      continue;
    }
    throw new FormulaError(`Unexpected "${c}"`);
  }
  out.push({ t: "eof" });
  return out;
}

// --- parser (precedence climbing) -----------------------------------------

type Node =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "call"; name: string; args: Node[] }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "un"; op: string; a: Node };

function parse(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const isOp = (v: string) => {
    const t = peek();
    return (t.t === "op" && t.v === v) || (t.t === "id" && t.v === v);
  };
  const expect = (v: string) => {
    if (!isOp(v)) throw new FormulaError(`Expected "${v}"`);
    next();
  };

  const orExpr = (): Node => {
    let a = andExpr();
    while (isOp("or") || isOp("||")) {
      next();
      a = { k: "bin", op: "or", a, b: andExpr() };
    }
    return a;
  };
  const andExpr = (): Node => {
    let a = notExpr();
    while (isOp("and") || isOp("&&")) {
      next();
      a = { k: "bin", op: "and", a, b: notExpr() };
    }
    return a;
  };
  const notExpr = (): Node => {
    if (isOp("not") || isOp("!")) {
      next();
      return { k: "un", op: "not", a: notExpr() };
    }
    return cmpExpr();
  };
  const cmpExpr = (): Node => {
    const a = addExpr();
    for (const op of ["==", "!=", ">=", "<=", ">", "<"]) {
      if (isOp(op)) {
        next();
        return { k: "bin", op, a, b: addExpr() };
      }
    }
    return a;
  };
  const addExpr = (): Node => {
    let a = mulExpr();
    while (isOp("+") || isOp("-")) {
      const op = (next() as { v: string }).v;
      a = { k: "bin", op, a, b: mulExpr() };
    }
    return a;
  };
  const mulExpr = (): Node => {
    let a = unary();
    while (isOp("*") || isOp("/") || isOp("%")) {
      const op = (next() as { v: string }).v;
      a = { k: "bin", op, a, b: unary() };
    }
    return a;
  };
  const unary = (): Node => {
    if (isOp("-")) {
      next();
      return { k: "un", op: "neg", a: unary() };
    }
    const base = primary();
    if (isOp("^")) {
      next();
      return { k: "bin", op: "^", a: base, b: unary() };
    }
    return base;
  };
  const primary = (): Node => {
    const t = next();
    if (t.t === "num") return { k: "num", v: t.v };
    if (t.t === "str") return { k: "str", v: t.v };
    if (t.t === "op" && t.v === "(") {
      const e = orExpr();
      expect(")");
      return e;
    }
    if (t.t === "id") {
      if (t.v === "true" || t.v === "false") return { k: "bool", v: t.v === "true" };
      expect("(");
      const args: Node[] = [];
      if (!isOp(")")) {
        args.push(orExpr());
        while (isOp(",")) {
          next();
          args.push(orExpr());
        }
      }
      expect(")");
      return { k: "call", name: t.v, args };
    }
    throw new FormulaError(t.t === "eof" ? "Unexpected end of formula" : "Unexpected token");
  };

  const root = orExpr();
  if (peek().t !== "eof") throw new FormulaError("Unexpected trailing input");
  return root;
}

/** Field names referenced via prop("…") (used to rewrite formulas on rename). */
export function referencedProps(src: string): string[] {
  const names: string[] = [];
  const walk = (n: Node) => {
    if (n.k === "call") {
      if (n.name === "prop" && n.args[0]?.k === "str") names.push(n.args[0].v);
      n.args.forEach(walk);
    } else if (n.k === "bin") {
      walk(n.a);
      walk(n.b);
    } else if (n.k === "un") walk(n.a);
  };
  try {
    walk(parse(src));
  } catch {
    /* invalid formula: nothing referenced */
  }
  return names;
}

/** Rewrites prop("old") → prop("new") without touching other text. */
export function renameProp(src: string, oldName: string, newName: string): string {
  const esc = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return src.replace(new RegExp(`prop\\(\\s*(["'])${esc}\\1\\s*\\)`, "g"), `prop("${newName.replace(/"/g, '\\"')}")`);
}

// --- coercions -------------------------------------------------------------

export function asText(c: Compiled): RawBuilder<unknown> {
  switch (c.type) {
    case "text":
      return c.sql;
    case "number":
      return sql`trim_scale((${c.sql})::numeric)::text`;
    case "boolean":
      return sql`(case when ${c.sql} then 'true' when not ${c.sql} then 'false' end)`;
    case "date":
      return sql`to_char(${c.sql}, 'YYYY-MM-DD')`;
    case "array":
      return sql`array_to_string((${c.sql})::text[], ', ')`;
    default:
      return sql`(${c.sql})::text`;
  }
}

export function asNumber(c: Compiled): RawBuilder<unknown> {
  switch (c.type) {
    case "number":
      return c.sql;
    case "boolean":
      return sql`(case when ${c.sql} then 1 when not ${c.sql} then 0 end)::double precision`;
    case "date":
      return sql`(extract(epoch from ${c.sql}) * 1000)::double precision`;
    case "array":
      return sql`coalesce(cardinality(${c.sql}), 0)::double precision`;
    default: {
      const t = asText(c);
      return sql`(case when ${t} ~ '^\\s*-?[0-9]+(\\.[0-9]+)?([eE][+-]?[0-9]+)?\\s*$' then (${t})::double precision end)`;
    }
  }
}

export function asBool(c: Compiled): RawBuilder<unknown> {
  switch (c.type) {
    case "boolean":
      return c.sql;
    case "number":
      return sql`coalesce(${c.sql} <> 0, false)`;
    case "array":
      return sql`coalesce(cardinality(${c.sql}), 0) > 0`;
    case "date":
      return sql`(${c.sql} is not null)`;
    default:
      return sql`coalesce(${asText(c)} <> '', false)`;
  }
}

function asDate(c: Compiled): RawBuilder<unknown> {
  if (c.type === "date") return c.sql;
  if (c.type === "number") return sql`to_timestamp(${c.sql} / 1000.0)`;
  const t = asText(c);
  return sql`(case when ${t} ~ '^\\d{4}-\\d{2}-\\d{2}' then (${t})::timestamptz end)`;
}

const UNITS: Record<string, string> = {
  years: "years",
  year: "years",
  months: "months",
  month: "months",
  weeks: "weeks",
  week: "weeks",
  days: "days",
  day: "days",
  hours: "hours",
  hour: "hours",
  minutes: "mins",
  minute: "mins",
};

const SECONDS_PER: Record<string, number> = { weeks: 604800, days: 86400, hours: 3600, mins: 60 };

// --- compiler --------------------------------------------------------------

export function compileFormula(src: string, resolve: PropResolver): Compiled {
  if (!src.trim()) return { sql: sql`null::text`, type: "text" };
  return compileNode(parse(src), resolve);
}

function lit(n: Node): string {
  if (n.k !== "str") throw new FormulaError("Expected a string literal");
  return n.v;
}

function compileNode(n: Node, resolve: PropResolver): Compiled {
  const c = (x: Node) => compileNode(x, resolve);
  switch (n.k) {
    case "num":
      return { sql: sql`${n.v}::double precision`, type: "number" };
    case "str":
      return { sql: sql`${n.v}::text`, type: "text" };
    case "bool":
      return { sql: n.v ? sql`true` : sql`false`, type: "boolean" };
    case "un": {
      const a = c(n.a);
      if (n.op === "neg") return { sql: sql`(-${asNumber(a)})`, type: "number" };
      return { sql: sql`(not ${asBool(a)})`, type: "boolean" };
    }
    case "bin": {
      const a = c(n.a);
      const b = c(n.b);
      switch (n.op) {
        case "and":
          return { sql: sql`(${asBool(a)} and ${asBool(b)})`, type: "boolean" };
        case "or":
          return { sql: sql`(${asBool(a)} or ${asBool(b)})`, type: "boolean" };
        case "+":
          if (a.type === "text" || b.type === "text" || a.type === "array" || b.type === "array")
            return { sql: sql`(coalesce(${asText(a)}, '') || coalesce(${asText(b)}, ''))`, type: "text" };
          if (a.type === "date" && b.type === "number") return { sql: sql`(${a.sql} + make_interval(days => (${b.sql})::int))`, type: "date" };
          return { sql: sql`(${asNumber(a)} + ${asNumber(b)})`, type: "number" };
        case "-":
          return { sql: sql`(${asNumber(a)} - ${asNumber(b)})`, type: "number" };
        case "*":
          return { sql: sql`(${asNumber(a)} * ${asNumber(b)})`, type: "number" };
        case "/":
          return { sql: sql`(${asNumber(a)} / nullif(${asNumber(b)}, 0))`, type: "number" };
        case "%":
          return { sql: sql`mod((${asNumber(a)})::numeric, nullif((${asNumber(b)})::numeric, 0))::double precision`, type: "number" };
        case "^":
          return { sql: sql`power(${asNumber(a)}, ${asNumber(b)})`, type: "number" };
        default: {
          const op = sql.raw(n.op === "==" ? "=" : n.op === "!=" ? "<>" : n.op);
          const both = a.type === b.type ? a.type : null;
          if (both === "number" || (a.type === "number" && b.type !== "text") || (b.type === "number" && a.type !== "text"))
            return { sql: sql`(${asNumber(a)} ${op} ${asNumber(b)})`, type: "boolean" };
          if (both === "date") return { sql: sql`(${a.sql} ${op} ${b.sql})`, type: "boolean" };
          if (both === "boolean") return { sql: sql`(${a.sql} ${op} ${b.sql})`, type: "boolean" };
          return { sql: sql`(${asText(a)} ${op} ${asText(b)})`, type: "boolean" };
        }
      }
    }
    case "call":
      return compileCall(n.name, n.args, resolve);
  }
}

function compileCall(name: string, args: Node[], resolve: PropResolver): Compiled {
  const c = (x: Node) => compileNode(x, resolve);
  const arity = (min: number, max = min) => {
    if (args.length < min || args.length > max) throw new FormulaError(`${name}() expects ${min === max ? min : `${min}-${max}`} argument(s)`);
  };
  const num1 = (fn: string) => {
    arity(1);
    return { sql: sql`${sql.raw(fn)}(${asNumber(c(args[0]))})`, type: "number" as const };
  };
  const txt1 = (fn: string) => {
    arity(1);
    return { sql: sql`${sql.raw(fn)}(${asText(c(args[0]))})`, type: "text" as const };
  };

  switch (name) {
    case "prop":
      arity(1);
      return resolve(lit(args[0]));
    case "if": {
      arity(3);
      const cond = c(args[0]);
      const a = c(args[1]);
      const b = c(args[2]);
      if (a.type === b.type && a.type !== "unknown") return { sql: sql`(case when ${asBool(cond)} then ${a.sql} else ${b.sql} end)`, type: a.type };
      if ((a.type === "number" || a.type === "unknown") && (b.type === "number" || b.type === "unknown"))
        return { sql: sql`(case when ${asBool(cond)} then ${asNumber(a)} else ${asNumber(b)} end)`, type: "number" };
      return { sql: sql`(case when ${asBool(cond)} then ${asText(a)} else ${asText(b)} end)`, type: "text" };
    }
    case "empty": {
      arity(1);
      const a = c(args[0]);
      const e = a.type === "array" ? sql`coalesce(cardinality(${a.sql}), 0) = 0` : a.type === "text" ? sql`coalesce(${a.sql}, '') = ''` : sql`(${a.sql}) is null`;
      return { sql: sql`(${e})`, type: "boolean" };
    }
    case "concat":
      if (args.length < 1) throw new FormulaError("concat() expects at least 1 argument");
      return { sql: sql`concat(${sql.join(args.map((x) => asText(c(x))))})`, type: "text" };
    case "join": {
      if (args.length < 2) throw new FormulaError("join() expects a separator and values");
      const [sep, ...rest] = args;
      return { sql: sql`concat_ws(${asText(c(sep))}, ${sql.join(rest.map((x) => asText(c(x))))})`, type: "text" };
    }
    case "length": {
      arity(1);
      const a = c(args[0]);
      if (a.type === "array") return { sql: sql`coalesce(cardinality(${a.sql}), 0)::double precision`, type: "number" };
      return { sql: sql`coalesce(length(${asText(a)}), 0)::double precision`, type: "number" };
    }
    case "lower":
      return txt1("lower");
    case "upper":
      return txt1("upper");
    case "trim":
      return txt1("btrim");
    case "contains":
      arity(2);
      return { sql: sql`(strpos(coalesce(${asText(c(args[0]))}, ''), coalesce(${asText(c(args[1]))}, '')) > 0)`, type: "boolean" };
    case "replace":
      arity(3);
      return { sql: sql`replace(${asText(c(args[0]))}, ${asText(c(args[1]))}, ${asText(c(args[2]))})`, type: "text" };
    case "slice":
    case "substring":
      arity(2, 3);
      return args.length === 3
        ? { sql: sql`substr(${asText(c(args[0]))}, (${asNumber(c(args[1]))})::int + 1, (${asNumber(c(args[2]))})::int - (${asNumber(c(args[1]))})::int)`, type: "text" }
        : { sql: sql`substr(${asText(c(args[0]))}, (${asNumber(c(args[1]))})::int + 1)`, type: "text" };
    case "format":
      arity(1);
      return { sql: asText(c(args[0])), type: "text" };
    case "toNumber":
      arity(1);
      return { sql: asNumber(c(args[0])), type: "number" };
    case "abs":
      return num1("abs");
    case "ceil":
      return num1("ceil");
    case "floor":
      return num1("floor");
    case "sqrt":
      return num1("sqrt");
    case "sign":
      return num1("sign");
    case "round": {
      arity(1, 2);
      const v = asNumber(c(args[0]));
      if (args.length === 1) return { sql: sql`round(${v})`, type: "number" };
      return { sql: sql`round((${v})::numeric, (${asNumber(c(args[1]))})::int)::double precision`, type: "number" };
    }
    case "pow":
      arity(2);
      return { sql: sql`power(${asNumber(c(args[0]))}, ${asNumber(c(args[1]))})`, type: "number" };
    case "min":
    case "max":
      if (args.length < 1) throw new FormulaError(`${name}() expects at least 1 argument`);
      return { sql: sql`${sql.raw(name === "min" ? "least" : "greatest")}(${sql.join(args.map((x) => asNumber(c(x))))})`, type: "number" };
    case "now":
      arity(0);
      return { sql: sql`now()`, type: "date" };
    case "today":
      arity(0);
      return { sql: sql`date_trunc('day', now())`, type: "date" };
    case "year":
    case "month":
    case "day":
    case "hour":
    case "minute": {
      arity(1);
      const part = name === "day" ? "day" : name;
      return { sql: sql`extract(${sql.raw(part)} from ${asDate(c(args[0]))})::double precision`, type: "number" };
    }
    case "dateAdd":
    case "dateSubtract": {
      arity(3);
      const unit = UNITS[lit(args[2])];
      if (!unit) throw new FormulaError(`Unknown unit "${lit(args[2])}"`);
      const sign = name === "dateAdd" ? sql.raw("+") : sql.raw("-");
      return { sql: sql`(${asDate(c(args[0]))} ${sign} make_interval(${sql.raw(unit)} => (${asNumber(c(args[1]))})::int))`, type: "date" };
    }
    case "dateBetween": {
      arity(3);
      const unit = UNITS[lit(args[2])];
      if (!unit) throw new FormulaError(`Unknown unit "${lit(args[2])}"`);
      const a = asDate(c(args[0]));
      const b = asDate(c(args[1]));
      if (unit === "years") return { sql: sql`extract(year from age(${a}, ${b}))::double precision`, type: "number" };
      if (unit === "months") return { sql: sql`(extract(year from age(${a}, ${b})) * 12 + extract(month from age(${a}, ${b})))::double precision`, type: "number" };
      return { sql: sql`trunc(extract(epoch from (${a} - ${b})) / ${SECONDS_PER[unit]})::double precision`, type: "number" };
    }
    case "formatDate": {
      arity(1, 2);
      const fmt = args[1] ? asText(compileNode(args[1], resolve)) : sql`'Mon DD, YYYY'`;
      return { sql: sql`to_char(${asDate(c(args[0]))}, ${fmt})`, type: "text" };
    }
    case "toDate":
    case "parseDate":
      arity(1);
      return { sql: asDate(c(args[0])), type: "date" };
    default:
      throw new FormulaError(`Unknown function ${name}()`);
  }
}
