import type { Field, FilterCondition, FilterGroup, Member, Row, SelectOption, View, ViewConfig } from "./types";
import { isFilterGroup } from "@shared/model";

export interface ViewField {
  field: Field;
  hidden: boolean;
  width: number;
}

const DEFAULT_WIDTH = 180;

/** Ordered fields of a view with visibility + widths. Title is always first and visible. */
export function viewFields(view: View, fields: Field[]): ViewField[] {
  const settings = view.config.fields ?? [];
  const byId = new Map(fields.map((f) => [f.id, f]));
  const out: ViewField[] = [];
  const seen = new Set<string>();
  const table = view.type === "table";
  const defaultHidden = (f: Field) => (table ? ["created_time", "updated_time", "created_by"].includes(f.id) : f.id !== "title");
  for (const s of settings) {
    const f = byId.get(s.fieldId);
    if (!f || seen.has(f.id)) continue;
    seen.add(f.id);
    out.push({ field: f, hidden: f.id === "title" ? false : !!s.hidden, width: s.width ?? (f.id === "title" ? 280 : DEFAULT_WIDTH) });
  }
  for (const f of fields) {
    if (seen.has(f.id)) continue;
    out.push({ field: f, hidden: defaultHidden(f), width: f.id === "title" ? 280 : DEFAULT_WIDTH });
  }
  const title = out.findIndex((v) => v.field.id === "title");
  if (title > 0) out.unshift(...out.splice(title, 1));
  return out;
}

/** Writes back a full field-settings list (keeps order explicit once the user touched it). */
export function withFieldSetting(view: View, fields: Field[], fieldId: string, patch: { hidden?: boolean; width?: number }): ViewConfig {
  const list = viewFields(view, fields).map((v) => ({ fieldId: v.field.id, hidden: v.hidden, width: v.width }));
  return { ...view.config, fields: list.map((s) => (s.fieldId === fieldId ? { ...s, ...patch } : s)) };
}

export function withFieldOrder(view: View, fields: Field[], orderedIds: string[]): ViewConfig {
  const list = viewFields(view, fields);
  const byId = new Map(list.map((v) => [v.field.id, v]));
  return {
    ...view.config,
    fields: orderedIds.filter((id) => byId.has(id)).map((id) => ({ fieldId: id, hidden: byId.get(id)!.hidden, width: byId.get(id)!.width })),
  };
}

// --- grouping ----------------------------------------------------------------

export interface RowGroup {
  key: string;
  label: string;
  option?: SelectOption;
  /** value to write when a row is dropped into / created in this group */
  value: unknown;
  rows: Row[];
}

export const GROUPABLE = new Set(["select", "status", "multi_select", "checkbox", "person", "text", "url", "email", "phone", "number"]);
export const NONE = "__none__";

export function groupRows(rows: Row[], field: Field, members: Member[]): RowGroup[] {
  const groups = new Map<string, RowGroup>();
  const ensure = (key: string, label: string, value: unknown, option?: SelectOption) => {
    if (!groups.has(key)) groups.set(key, { key, label, value, option, rows: [] });
    return groups.get(key)!;
  };
  const none = () => ensure(NONE, `No ${field.name}`, field.type === "multi_select" || field.type === "person" ? [] : null);

  if (field.type === "select" || field.type === "status" || field.type === "multi_select") {
    for (const o of field.config.options ?? []) ensure(o.id, o.name, field.type === "multi_select" ? [o.id] : o.id, o);
  }
  if (field.type === "checkbox") {
    ensure("true", "Checked", true);
    ensure("false", "Unchecked", false);
  }

  for (const r of rows) {
    const v = r.values[field.id];
    if (field.type === "checkbox") groups.get(v ? "true" : "false")!.rows.push(r);
    else if (Array.isArray(v)) {
      if (!v.length) none().rows.push(r);
      for (const id of v as string[]) {
        if (field.type === "person") {
          const m = members.find((x) => x.id === id);
          ensure(id, m?.name || m?.email || id, [id]).rows.push(r);
        } else {
          const g = groups.get(id);
          (g ?? none()).rows.push(r);
        }
      }
    } else if (v === null || v === undefined || v === "") none().rows.push(r);
    else {
      const key = String(v);
      (groups.get(key) ?? ensure(key, key, v)).rows.push(r);
    }
  }
  const list = [...groups.values()];
  const n = list.findIndex((g) => g.key === NONE);
  if (n >= 0) list.unshift(...list.splice(n, 1)); // "No value" first, like Notion
  return list;
}

/** New value of a multi-valued group field when a row moves from one group to another. */
export function moveGroupValue(field: Field, current: unknown, from: RowGroup | undefined, to: RowGroup): unknown {
  if (field.type === "multi_select" || field.type === "person") {
    const arr = ((current as string[] | null) ?? []).filter((x) => !from || from.key === NONE || x !== from.key);
    const add = (to.value as string[])[0];
    return add && !arr.includes(add) ? [...arr, add] : arr;
  }
  return to.value;
}

// --- prefill new rows from simple filters ---------------------------------------

export function prefillFromFilter(filter: FilterGroup | null | undefined, fields: Field[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!filter || filter.conjunction !== "and") return out;
  for (const c of filter.conditions) {
    if (isFilterGroup(c)) continue;
    const cond = c as FilterCondition;
    const f = fields.find((x) => x.id === cond.fieldId);
    if (!f || f.system) continue;
    const vals = Array.isArray(cond.value) ? (cond.value as string[]) : cond.value ? [cond.value as string] : [];
    if ((f.type === "select" || f.type === "status") && (cond.operator === "is" || cond.operator === "has_any") && vals.length) out[f.id] = vals[0];
    else if (f.type === "multi_select" && (cond.operator === "has_any" || cond.operator === "has_all") && vals.length) out[f.id] = vals;
    else if (f.type === "checkbox") out[f.id] = cond.operator === "is_checked";
    else if ((f.type === "text" || f.type === "url" || f.type === "email") && cond.operator === "is" && typeof cond.value === "string") out[f.id] = cond.value;
  }
  return out;
}

export const countFilters = (g: FilterGroup | null | undefined): number => (g ? g.conditions.reduce((n, c) => n + (isFilterGroup(c) ? countFilters(c) : 1), 0) : 0);
