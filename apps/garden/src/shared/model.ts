// Shared Garden contract — imported by the server and (via the `@shared`
// alias) by the webapp. Pure types + tiny pure helpers only: no Node or DOM.

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

/** User-defined field types (stored as `kind = 'field'` rows). */
export const USER_FIELD_TYPES = [
  "text",
  "number",
  "select",
  "multi_select",
  "status",
  "date",
  "checkbox",
  "url",
  "email",
  "phone",
  "person",
  "relation",
  "rollup",
  "formula",
] as const;
export type UserFieldType = (typeof USER_FIELD_TYPES)[number];

/** Virtual fields every database has; they map onto database_record columns. */
export const SYSTEM_FIELD_IDS = ["title", "created_time", "updated_time", "created_by"] as const;
export type SystemFieldId = (typeof SYSTEM_FIELD_IDS)[number];

export type FieldType = UserFieldType | SystemFieldId;

/** Types backed by a physical column in the database's dynamic table. */
export const PHYSICAL_FIELD_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  "text",
  "number",
  "select",
  "multi_select",
  "status",
  "date",
  "checkbox",
  "url",
  "email",
  "phone",
  "person",
  "relation",
]);

export const OPTION_COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] as const;
export type OptionColor = (typeof OPTION_COLORS)[number];

export type StatusGroup = "todo" | "in_progress" | "complete";

export interface SelectOption {
  id: string;
  name: string;
  color: OptionColor;
  /** status fields only */
  group?: StatusGroup;
}

export const ROLLUP_FNS = [
  "show_original",
  "count",
  "count_values",
  "count_unique",
  "count_empty",
  "count_not_empty",
  "percent_empty",
  "percent_not_empty",
  "sum",
  "average",
  "min",
  "max",
  "range",
  "checked",
  "unchecked",
  "percent_checked",
  "earliest",
  "latest",
] as const;
export type RollupFn = (typeof ROLLUP_FNS)[number];

/** Result type of computed fields (rollup/formula) — drives filters + rendering. */
export type ValueType = "text" | "number" | "boolean" | "date" | "array" | "unknown";

export interface FieldConfig {
  options?: SelectOption[];
  number?: { format: "number" | "integer" | "percent" | "currency"; currency?: string };
  date?: { includeTime?: boolean };
  relation?: { databaseId: string; reverseFieldId?: string | null; limitOne?: boolean };
  rollup?: { relationFieldId: string; targetFieldId: string; fn: RollupFn };
  formula?: { expression: string };
  description?: string;
}

export interface Field {
  id: string;
  databaseId: string;
  name: string;
  type: FieldType;
  config: FieldConfig;
  position: number;
  system: boolean;
  /** Computed fields: type of the value; physical fields: derived from type. */
  valueType: ValueType;
  /** Formula compile error, if any (field still listed; value is null). */
  error?: string | null;
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export const VIEW_TYPES = ["table", "kanban", "list", "gallery", "calendar"] as const;
export type ViewType = (typeof VIEW_TYPES)[number];

export const FILTER_OPERATORS = [
  "is",
  "is_not",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "is_empty",
  "is_not_empty",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "before",
  "after",
  "on_or_before",
  "on_or_after",
  "is_checked",
  "is_unchecked",
  "has_any",
  "has_all",
  "has_none",
] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export interface FilterCondition {
  id: string;
  fieldId: string;
  operator: FilterOperator;
  value?: unknown;
}

export interface FilterGroup {
  id: string;
  conjunction: "and" | "or";
  conditions: FilterNode[];
}

export type FilterNode = FilterCondition | FilterGroup;

export const isFilterGroup = (n: FilterNode): n is FilterGroup => "conditions" in n;

export interface SortSpec {
  fieldId: string;
  direction: "asc" | "desc";
}

export interface ViewFieldSetting {
  fieldId: string;
  hidden?: boolean;
  width?: number;
}

export interface ViewConfig {
  filter?: FilterGroup | null;
  sorts?: SortSpec[];
  groupBy?: { fieldId: string; hideEmpty?: boolean; collapsed?: string[] } | null;
  /** Field order + visibility + widths. Fields missing here are appended (visible for table, hidden for cards). */
  fields?: ViewFieldSetting[];
  calendar?: { dateFieldId?: string | null };
  gallery?: { cover?: "page" | "none"; size?: "small" | "medium" | "large" };
  wrap?: boolean;
}

export interface View {
  id: string;
  databaseId: string;
  name: string;
  type: ViewType;
  position: number;
  config: ViewConfig;
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export type RecordKind = "page" | "database";

export interface PageConfig {
  fullWidth?: boolean;
}

export interface DatabaseConfig {
  isDefault?: boolean;
  inline?: boolean;
}

export interface RecordRef {
  id: string;
  kind: RecordKind;
  title: string;
  icon: string | null;
}

export interface TreeNode extends RecordRef {
  parentId: string | null;
  databaseId: string | null;
  position: number;
  isFavorite: boolean;
  inline: boolean;
  /** Number of live tree children (pages + databases; db rows counted for databases). */
  childCount: number;
}

export interface RecordDetail extends RecordRef {
  parentId: string | null;
  databaseId: string | null;
  cover: string | null;
  content: Record<string, unknown> | null;
  config: PageConfig & DatabaseConfig;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  deletedAt: string | null;
  ancestors: RecordRef[];
  /** Page only: its database's fields and its property values. */
  fields?: Field[];
  values?: Record<string, unknown>;
  relations?: Record<string, RecordRef>;
  isDefaultDatabase?: boolean;
}

export interface Row {
  id: string;
  title: string;
  icon: string | null;
  cover: string | null;
  preview: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  /** fieldId → value (user + computed fields). */
  values: Record<string, unknown>;
}

export interface QueryResult {
  rows: Row[];
  total: number;
  /** Titles for every record id referenced by relation values. */
  relations: Record<string, RecordRef>;
}

export interface DatabaseDetail {
  database: RecordDetail;
  fields: Field[];
  views: View[];
}

export interface SearchHit extends RecordRef {
  databaseId: string | null;
  parentTitle: string | null;
  snippet: string;
}

export interface TrashItem extends RecordRef {
  deletedAt: string;
  parentTitle: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function valueTypeOf(type: FieldType): ValueType {
  switch (type) {
    case "number":
      return "number";
    case "checkbox":
      return "boolean";
    case "date":
    case "created_time":
    case "updated_time":
      return "date";
    case "multi_select":
    case "person":
    case "relation":
      return "array";
    case "rollup":
    case "formula":
      return "unknown";
    default:
      return "text";
  }
}

/** Operators that don't take a value. */
export const VALUELESS_OPERATORS: ReadonlySet<FilterOperator> = new Set<FilterOperator>(["is_empty", "is_not_empty", "is_checked", "is_unchecked"]);

export function operatorsFor(field: Pick<Field, "type" | "valueType">): FilterOperator[] {
  switch (field.type) {
    case "title":
    case "text":
    case "url":
    case "email":
    case "phone":
      return ["contains", "not_contains", "is", "is_not", "starts_with", "ends_with", "is_empty", "is_not_empty"];
    case "number":
      return ["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"];
    case "checkbox":
      return ["is_checked", "is_unchecked"];
    case "select":
    case "status":
      return ["is", "is_not", "has_any", "has_none", "is_empty", "is_not_empty"];
    case "multi_select":
    case "person":
    case "relation":
      return ["has_any", "has_all", "has_none", "is_empty", "is_not_empty"];
    case "created_by":
      return ["has_any", "has_none"];
    case "date":
    case "created_time":
    case "updated_time":
      return ["is", "before", "after", "on_or_before", "on_or_after", "is_empty", "is_not_empty"];
    default:
      switch (field.valueType) {
        case "number":
          return ["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"];
        case "boolean":
          return ["is_checked", "is_unchecked"];
        case "date":
          return ["is", "before", "after", "on_or_before", "on_or_after", "is_empty", "is_not_empty"];
        default:
          return ["contains", "not_contains", "is", "is_not", "is_empty", "is_not_empty"];
      }
  }
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  title: "Title",
  text: "Text",
  number: "Number",
  select: "Select",
  multi_select: "Multi-select",
  status: "Status",
  date: "Date",
  checkbox: "Checkbox",
  url: "URL",
  email: "Email",
  phone: "Phone",
  person: "Person",
  relation: "Relation",
  rollup: "Rollup",
  formula: "Formula",
  created_time: "Created time",
  updated_time: "Last edited time",
  created_by: "Created by",
};

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  not_contains: "does not contain",
  starts_with: "starts with",
  ends_with: "ends with",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  eq: "=",
  neq: "≠",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  before: "is before",
  after: "is after",
  on_or_before: "is on or before",
  on_or_after: "is on or after",
  is_checked: "is checked",
  is_unchecked: "is unchecked",
  has_any: "is any of",
  has_all: "has all of",
  has_none: "is none of",
};
