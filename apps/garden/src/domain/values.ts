import type { FieldConfig, FieldType, OptionColor, SelectOption } from "../shared/model.js";
import { OPTION_COLORS } from "../shared/model.js";
import { HttpError } from "../http.js";
import { isUuid } from "./dynamic-table.js";

// ---------------------------------------------------------------------------
// Incoming value validation (API → column value) and type conversion (old
// column value → new column value when a field's type changes).
// ---------------------------------------------------------------------------

export interface FieldLike {
  id: string;
  type: FieldType;
  config: FieldConfig;
}

const invalid = (f: FieldLike, why = "invalid value") => new HttpError(400, "invalid_value", `${f.id}: ${why}`);

const str = (v: unknown, max = 10_000) => (typeof v === "string" ? v.slice(0, max) : String(v).slice(0, max));

/** Validates and normalizes an API value for a physical field. `null`/"" clears. */
export function coerceValue(field: FieldLike, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const options = field.config.options ?? [];
  switch (field.type) {
    case "text":
    case "url":
    case "email":
    case "phone": {
      const s = str(value);
      return s === "" ? null : s;
    }
    case "number": {
      const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
      if (!Number.isFinite(n)) throw invalid(field, "not a number");
      return n;
    }
    case "checkbox":
      if (typeof value !== "boolean") throw invalid(field, "expected boolean");
      return value;
    case "date": {
      if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw invalid(field, "expected ISO date");
      return new Date(value).toISOString();
    }
    case "select":
    case "status": {
      if (typeof value !== "string") throw invalid(field, "expected option id");
      if (value === "") return null;
      if (!options.some((o) => o.id === value)) throw invalid(field, "unknown option");
      return value;
    }
    case "multi_select": {
      if (!Array.isArray(value)) throw invalid(field, "expected option id array");
      const ids = [...new Set(value.filter((v): v is string => typeof v === "string"))];
      if (!ids.every((id) => options.some((o) => o.id === id))) throw invalid(field, "unknown option");
      return ids.length ? ids : null;
    }
    case "person": {
      if (!Array.isArray(value)) throw invalid(field, "expected user id array");
      const ids = [...new Set(value.filter((v): v is string => typeof v === "string" && v.length > 0))];
      return ids.length ? ids : null;
    }
    case "relation": {
      if (!Array.isArray(value)) throw invalid(field, "expected record id array");
      let ids = [...new Set(value.filter(isUuid).map((v) => v.toLowerCase()))];
      if (field.config.relation?.limitOne) ids = ids.slice(0, 1);
      return ids.length ? ids : null;
    }
    default:
      throw invalid(field, "field is read-only");
  }
}

// ---------------------------------------------------------------------------
// Type conversion
// ---------------------------------------------------------------------------

const nextColor = (i: number): OptionColor => OPTION_COLORS[(i + 1) % OPTION_COLORS.length];

export function newOption(name: string, existing: SelectOption[], group?: SelectOption["group"]): SelectOption {
  return { id: crypto.randomUUID(), name, color: nextColor(existing.length), ...(group ? { group } : {}) };
}

export function defaultStatusOptions(): SelectOption[] {
  return [
    { id: crypto.randomUUID(), name: "Not started", color: "gray", group: "todo" },
    { id: crypto.randomUUID(), name: "In progress", color: "blue", group: "in_progress" },
    { id: crypto.randomUUID(), name: "Done", color: "green", group: "complete" },
  ];
}

/** Old value → list of human strings (the neutral form every conversion goes through). */
function toStrings(from: FieldLike, value: unknown): string[] {
  if (value === null || value === undefined) return [];
  const opts = from.config.options ?? [];
  const optName = (id: unknown) => opts.find((o) => o.id === id)?.name;
  switch (from.type) {
    case "select":
    case "status": {
      const n = optName(value);
      return n ? [n] : [];
    }
    case "multi_select":
      return (value as unknown[]).map(optName).filter((n): n is string => !!n);
    case "person":
    case "relation":
      return (value as unknown[]).map(String);
    case "checkbox":
      return value ? ["true"] : [];
    case "date":
      return [new Date(value as string).toISOString()];
    default:
      return [String(value)];
  }
}

/**
 * Converts every existing value of a field to a new type. Option-based
 * targets reuse (or create) options by name; the returned config carries the
 * resulting option list.
 */
export function convertValues(
  from: FieldLike,
  toType: FieldType,
  toConfig: FieldConfig,
  rows: { record_id: string; value: unknown }[],
): { rows: { record_id: string; value: unknown }[]; config: FieldConfig } {
  const config: FieldConfig = { ...toConfig };
  const optionTarget = toType === "select" || toType === "multi_select" || toType === "status";
  const fromOptions = from.type === "select" || from.type === "multi_select" || from.type === "status";

  // Option types → option types: keep ids and options as they are.
  if (optionTarget && fromOptions) {
    const options = (from.config.options ?? []).map((o) => ({ ...o, ...(toType === "status" ? { group: o.group ?? "todo" } : {}) }));
    config.options = toConfig.options?.length ? toConfig.options : options;
    return {
      config,
      rows: rows.map((r) => {
        const ids = Array.isArray(r.value) ? (r.value as string[]) : r.value ? [r.value as string] : [];
        return { record_id: r.record_id, value: toType === "multi_select" ? (ids.length ? ids : null) : (ids[0] ?? null) };
      }),
    };
  }

  const options: SelectOption[] = optionTarget ? [...(toConfig.options ?? [])] : [];
  const optionId = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    let o = options.find((x) => x.name.toLowerCase() === trimmed.toLowerCase());
    if (!o) {
      o = newOption(trimmed, options, toType === "status" ? "todo" : undefined);
      options.push(o);
    }
    return o.id;
  };

  const out = rows.map((r) => {
    const parts = toStrings(from, r.value);
    const joined = parts.join(", ");
    let value: unknown = null;
    switch (toType) {
      case "text":
      case "url":
      case "email":
      case "phone":
        value = joined || null;
        break;
      case "number": {
        const n = from.type === "checkbox" ? (r.value ? 1 : 0) : from.type === "date" ? Date.parse(parts[0] ?? "") : parseFloat(joined);
        value = Number.isFinite(n) ? n : null;
        break;
      }
      case "checkbox":
        value = parts.length > 0 && !["false", "0", "no", "off", ""].includes(joined.trim().toLowerCase());
        break;
      case "date": {
        const t = Date.parse(parts[0] ?? "");
        value = Number.isNaN(t) ? null : new Date(t).toISOString();
        break;
      }
      case "select":
      case "status":
        value = parts.length ? optionId(parts[0].split(",")[0]) : null;
        break;
      case "multi_select": {
        const ids = parts.flatMap((p) => p.split(",")).map(optionId).filter((x): x is string => !!x);
        value = ids.length ? [...new Set(ids)] : null;
        break;
      }
      case "person":
        value = from.type === "person" ? r.value : null;
        break;
      case "relation":
        value = null; // relations never survive a type change (target db unknown)
        break;
    }
    return { record_id: r.record_id, value };
  });
  if (optionTarget) config.options = options;
  return { rows: out, config };
}
