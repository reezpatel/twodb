import { z } from "zod";
import { ulid } from "ulid";
import { projectCrud } from "../lib/crud.js";
import { route, type RouteDef } from "../lib/route.js";
import { resolveProject } from "../lib/access.js";
import { toApi, toApiList } from "../lib/rows.js";
import { notFound, conflict } from "../lib/http.js";
import { color, statusCategory, statusSchema, ticketTypeSchema, labelGroupSchema, labelSchema, anyObject, ok } from "./schemas.js";

/** Default workflow seeded into every new project (overridable by a project template). */
export const DEFAULT_STATUSES = [
  { name: "Backlog", color: "#9ca3af", category: "backlog" },
  { name: "Todo", color: "#6b7280", category: "todo" },
  { name: "In Progress", color: "#f59e0b", category: "in_progress" },
  { name: "In Review", color: "#8b5cf6", category: "in_progress" },
  { name: "Done", color: "#22c55e", category: "done" },
  { name: "Canceled", color: "#ef4444", category: "canceled" },
] as const;

export const DEFAULT_TYPES = [
  { name: "Task", icon: "check-square", color: "#3b82f6" },
  { name: "Bug", icon: "bug", color: "#ef4444" },
  { name: "Feature", icon: "sparkles", color: "#8b5cf6" },
  { name: "Chore", icon: "wrench", color: "#6b7280" },
] as const;

const fieldType = z.enum(["text", "number", "date", "select", "checkbox", "url"]);
const customFieldSchema = z.object({ id: z.string(), projectId: z.string(), name: z.string(), type: fieldType, position: z.number() });
const optionSchema = z.object({ id: z.string(), fieldId: z.string(), label: z.string(), color: z.string(), position: z.number() });

export const configRoutes: RouteDef[] = [
  ...projectCrud({
    entity: "Status",
    plural: "Statuses",
    table: "status",
    segment: "statuses",
    columns: ["name", "color", "category", "position"],
    create: z.object({ name: z.string().min(1), color: color.optional(), category: statusCategory, position: z.number().optional() }),
    update: z.object({ name: z.string().min(1).optional(), color: color.optional(), category: statusCategory.optional(), position: z.number().optional() }),
    response: statusSchema,
  }),
  ...projectCrud({
    entity: "TicketType",
    plural: "TicketTypes",
    table: "ticket_type",
    segment: "ticket-types",
    columns: ["name", "icon", "color", "position"],
    create: z.object({ name: z.string().min(1), icon: z.string().optional(), color: color.optional(), position: z.number().optional() }),
    update: z.object({ name: z.string().min(1).optional(), icon: z.string().optional(), color: color.optional(), position: z.number().optional() }),
    response: ticketTypeSchema,
  }),
  ...projectCrud({
    entity: "LabelGroup",
    plural: "LabelGroups",
    table: "label_group",
    segment: "label-groups",
    columns: ["name", "position"],
    create: z.object({ name: z.string().min(1), position: z.number().optional() }),
    update: z.object({ name: z.string().min(1).optional(), position: z.number().optional() }),
    response: labelGroupSchema,
  }),
  ...projectCrud({
    entity: "Label",
    plural: "Labels",
    table: "label",
    segment: "labels",
    position: null,
    orderBy: "name",
    columns: ["name", "color", "groupId"],
    fks: { groupId: "label_group" },
    create: z.object({ name: z.string().min(1), color: color.optional(), groupId: z.string().nullable().optional() }),
    update: z.object({ name: z.string().min(1).optional(), color: color.optional(), groupId: z.string().nullable().optional() }),
    response: labelSchema,
  }),
  ...projectCrud({
    entity: "CustomField",
    plural: "CustomFields",
    table: "custom_field",
    segment: "custom-fields",
    columns: ["name", "type", "position"],
    create: z.object({ name: z.string().min(1), type: fieldType, position: z.number().optional() }),
    update: z.object({ name: z.string().min(1).optional(), position: z.number().optional() }),
    response: customFieldSchema,
  }),

  route({
    name: "listCustomFieldOptions",
    method: "GET",
    path: "/projects/:projectId/custom-fields/:fieldId/options",
    description: "Options of a `select` custom field.",
    request: z.object({ projectId: z.string(), fieldId: z.string() }),
    response: z.array(optionSchema),
    handler: async (ctx, { projectId, fieldId }) => {
      const p = await resolveProject(ctx, projectId);
      const f = await ctx.db.selectFrom("custom_field").select("id").where("id", "=", fieldId).where("project_id", "=", p.id).executeTakeFirst();
      if (!f) throw notFound("custom_field_not_found");
      return toApiList(await ctx.db.selectFrom("custom_field_option").selectAll().where("field_id", "=", fieldId).orderBy("position").execute());
    },
  }),
  route({
    name: "createCustomFieldOption",
    method: "POST",
    path: "/projects/:projectId/custom-fields/:fieldId/options",
    description: "Adds an option to a `select` custom field.",
    request: z.object({ projectId: z.string(), fieldId: z.string(), label: z.string().min(1), color: color.optional() }),
    response: optionSchema,
    handler: async (ctx, { projectId, fieldId, label, color: c }) => {
      const p = await resolveProject(ctx, projectId);
      const f = await ctx.db.selectFrom("custom_field").select(["id", "type"]).where("id", "=", fieldId).where("project_id", "=", p.id).executeTakeFirst();
      if (!f) throw notFound("custom_field_not_found");
      if (f.type !== "select") throw conflict("options only apply to select fields");
      const max = await ctx.db.selectFrom("custom_field_option").select((eb) => eb.fn.max("position").as("m")).where("field_id", "=", fieldId).executeTakeFirst();
      const row = await ctx.db
        .insertInto("custom_field_option")
        .values({ id: ulid(), field_id: fieldId, label, color: c ?? "#6b7280", position: Number(max?.m ?? 0) + 1000 })
        .returningAll()
        .executeTakeFirstOrThrow();
      return toApi(row);
    },
  }),
  route({
    name: "updateCustomFieldOption",
    method: "PATCH",
    path: "/projects/:projectId/custom-fields/:fieldId/options/:id",
    description: "Renames / recolors / reorders a custom-field option.",
    request: z.object({ projectId: z.string(), fieldId: z.string(), id: z.string(), label: z.string().optional(), color: color.optional(), position: z.number().optional() }),
    response: optionSchema,
    handler: async (ctx, { projectId, fieldId, id, label, color: c, position }) => {
      const p = await resolveProject(ctx, projectId);
      const f = await ctx.db.selectFrom("custom_field").select("id").where("id", "=", fieldId).where("project_id", "=", p.id).executeTakeFirst();
      if (!f) throw notFound("custom_field_not_found");
      const patch: Record<string, any> = {};
      if (label !== undefined) patch.label = label;
      if (c !== undefined) patch.color = c;
      if (position !== undefined) patch.position = position;
      const row = Object.keys(patch).length
        ? await ctx.db.updateTable("custom_field_option").set(patch).where("id", "=", id).where("field_id", "=", fieldId).returningAll().executeTakeFirst()
        : await ctx.db.selectFrom("custom_field_option").selectAll().where("id", "=", id).where("field_id", "=", fieldId).executeTakeFirst();
      if (!row) throw notFound("option_not_found");
      return toApi(row);
    },
  }),
  route({
    name: "deleteCustomFieldOption",
    method: "DELETE",
    path: "/projects/:projectId/custom-fields/:fieldId/options/:id",
    description: "Deletes a custom-field option.",
    request: z.object({ projectId: z.string(), fieldId: z.string(), id: z.string() }),
    response: ok,
    handler: async (ctx, { projectId, fieldId, id }) => {
      const p = await resolveProject(ctx, projectId);
      const f = await ctx.db.selectFrom("custom_field").select("id").where("id", "=", fieldId).where("project_id", "=", p.id).executeTakeFirst();
      if (!f) throw notFound("custom_field_not_found");
      await ctx.db.deleteFrom("custom_field_option").where("id", "=", id).where("field_id", "=", fieldId).execute();
      return { ok: true };
    },
  }),
  route({
    name: "getProjectConfig",
    method: "GET",
    path: "/projects/:projectId/config",
    description:
      "Everything the UI needs to render a project in one round trip: statuses, ticket types, label groups, labels, custom fields with options.",
    request: z.object({ projectId: z.string() }),
    response: anyObject,
    handler: async (ctx, { projectId }) => {
      const p = await resolveProject(ctx, projectId);
      const by = (t: string, order: string) => ctx.db.selectFrom(t as any).selectAll().where("project_id", "=", p.id).orderBy(order as any).execute();
      const [statuses, types, groups, labels, fields] = await Promise.all([
        by("status", "position"),
        by("ticket_type", "position"),
        by("label_group", "position"),
        by("label", "name"),
        by("custom_field", "position"),
      ]);
      const fieldIds = fields.map((f: any) => f.id);
      const options = fieldIds.length
        ? await ctx.db.selectFrom("custom_field_option").selectAll().where("field_id", "in", fieldIds).orderBy("position").execute()
        : [];
      return {
        statuses: toApiList(statuses),
        ticketTypes: toApiList(types),
        labelGroups: toApiList(groups),
        labels: toApiList(labels),
        customFields: fields.map((f: any) => ({ ...toApi(f), options: toApiList(options.filter((o: any) => o.field_id === f.id)) })),
      };
    },
  }),
];
