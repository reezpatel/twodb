import { z } from "zod";
import { FILTER_OPERATORS, OPTION_COLORS, ROLLUP_FNS, USER_FIELD_TYPES, VIEW_TYPES, type FilterNode } from "./shared/model.js";

// Request/response schemas shared by the manifest (docs) and the routes (validation).

export const uuid = z.string().uuid();
export const idParam = z.object({ id: uuid });

const json = z.record(z.string(), z.unknown());

export const selectOption = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  color: z.enum(OPTION_COLORS),
  group: z.enum(["todo", "in_progress", "complete"]).optional(),
});

export const fieldConfig = z.object({
  options: z.array(selectOption).max(500).optional(),
  number: z.object({ format: z.enum(["number", "integer", "percent", "currency"]), currency: z.string().max(8).optional() }).optional(),
  date: z.object({ includeTime: z.boolean().optional() }).optional(),
  relation: z.object({ databaseId: uuid, reverseFieldId: uuid.nullable().optional(), limitOne: z.boolean().optional() }).optional(),
  rollup: z.object({ relationFieldId: uuid, targetFieldId: z.string().min(1), fn: z.enum(ROLLUP_FNS) }).optional(),
  formula: z.object({ expression: z.string().max(10_000) }).optional(),
  description: z.string().max(2000).optional(),
});

const filterCondition = z.object({ id: z.string(), fieldId: z.string(), operator: z.enum(FILTER_OPERATORS), value: z.unknown().optional() });
export const filterGroup: z.ZodType<{ id: string; conjunction: "and" | "or"; conditions: FilterNode[] }> = z.lazy(() =>
  z.object({
    id: z.string(),
    conjunction: z.enum(["and", "or"]),
    conditions: z.array(z.union([filterCondition, filterGroup])).max(50),
  }),
) as never;

export const sortSpec = z.object({ fieldId: z.string(), direction: z.enum(["asc", "desc"]) });

export const viewConfig = z.object({
  filter: filterGroup.nullable().optional(),
  sorts: z.array(sortSpec).max(20).optional(),
  groupBy: z.object({ fieldId: z.string(), hideEmpty: z.boolean().optional(), collapsed: z.array(z.string()).optional() }).nullable().optional(),
  fields: z.array(z.object({ fieldId: z.string(), hidden: z.boolean().optional(), width: z.number().min(40).max(2000).optional() })).optional(),
  calendar: z.object({ dateFieldId: z.string().nullable().optional() }).optional(),
  gallery: z.object({ cover: z.enum(["page", "none"]).optional(), size: z.enum(["small", "medium", "large"]).optional() }).optional(),
  wrap: z.boolean().optional(),
});

export const createPage = z.object({
  parentId: uuid.nullable().optional(),
  title: z.string().max(500).optional(),
  icon: z.string().max(500).nullable().optional(),
  content: json.optional(),
  values: json.optional(),
  position: z.number().optional(),
});

export const createDatabase = z.object({
  parentId: uuid.nullable().optional(),
  title: z.string().max(500).optional(),
  icon: z.string().max(500).nullable().optional(),
  inline: z.boolean().optional(),
});

export const patchRecord = idParam.extend({
  title: z.string().max(500).optional(),
  icon: z.string().max(2000).nullable().optional(),
  cover: z.string().max(2000).nullable().optional(),
  content: json.optional(),
  config: z.object({ fullWidth: z.boolean().optional() }).optional(),
  isFavorite: z.boolean().optional(),
  parentId: uuid.nullable().optional(),
  position: z.number().optional(),
});

export const patchValues = idParam.extend({ values: json });

export const queryRows = idParam.extend({
  viewId: uuid.optional(),
  filter: filterGroup.nullable().optional(),
  sorts: z.array(sortSpec).optional(),
  search: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(2000).optional(),
  offset: z.number().int().min(0).optional(),
});

export const createField = idParam.extend({
  name: z.string().min(1).max(200),
  type: z.enum(USER_FIELD_TYPES),
  config: fieldConfig.optional(),
  position: z.number().optional(),
  twoWay: z.boolean().optional(),
  reverseName: z.string().max(200).optional(),
});

export const patchField = idParam.extend({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(USER_FIELD_TYPES).optional(),
  config: fieldConfig.optional(),
  position: z.number().optional(),
});

export const createView = idParam.extend({ name: z.string().min(1).max(100), type: z.enum(VIEW_TYPES), config: viewConfig.optional() });
export const patchView = idParam.extend({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(VIEW_TYPES).optional(),
  config: viewConfig.optional(),
  position: z.number().optional(),
});

export const searchQuery = z.object({
  q: z.string().max(200).default(""),
  databaseId: uuid.optional(),
  kind: z.enum(["page", "database"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// --- responses (documentary) ----------------------------------------------

export const recordRef = z.object({ id: z.string(), kind: z.enum(["page", "database"]), title: z.string(), icon: z.string().nullable() });
export const treeNode = recordRef.extend({
  parentId: z.string().nullable(),
  databaseId: z.string().nullable(),
  position: z.number(),
  isFavorite: z.boolean(),
  inline: z.boolean(),
  childCount: z.number(),
});
export const field = z.object({
  id: z.string(),
  databaseId: z.string(),
  name: z.string(),
  type: z.string(),
  config: fieldConfig,
  position: z.number(),
  system: z.boolean(),
  valueType: z.string(),
  error: z.string().nullable().optional(),
});
export const view = z.object({ id: z.string(), databaseId: z.string(), name: z.string(), type: z.enum(VIEW_TYPES), position: z.number(), config: viewConfig });
export const recordDetail = recordRef.extend({
  parentId: z.string().nullable(),
  databaseId: z.string().nullable(),
  cover: z.string().nullable(),
  content: json.nullable(),
  config: json,
  isFavorite: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  deletedAt: z.string().nullable(),
  ancestors: z.array(recordRef),
  fields: z.array(field).optional(),
  values: json.optional(),
  relations: z.record(z.string(), recordRef).optional(),
  isDefaultDatabase: z.boolean().optional(),
});
export const row = z.object({
  id: z.string(),
  title: z.string(),
  icon: z.string().nullable(),
  cover: z.string().nullable(),
  preview: z.string(),
  isFavorite: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
  values: json,
});
export const ok = z.object({ ok: z.literal(true) });
