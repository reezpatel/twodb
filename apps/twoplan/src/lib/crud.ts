import { ulid } from "ulid";
import { z, type ZodObject, type ZodRawShape } from "zod";
import { route, type RouteDef } from "./route.js";
import { resolveProject, assertInProject } from "./access.js";
import { toApi, toApiList, toColumns } from "./rows.js";
import { notFound } from "./http.js";

export interface ProjectCrudOpts {
  /** Singular PascalCase for endpoint names, e.g. "Status". */
  entity: string;
  /** Plural PascalCase for list name, e.g. "Statuses". */
  plural: string;
  table: string;
  /** kebab path segment, e.g. "statuses". */
  segment: string;
  create: ZodObject<ZodRawShape>;
  update: ZodObject<ZodRawShape>;
  response: z.ZodType;
  /** camelCase columns writable through create/update. */
  columns: readonly string[];
  /** Column holding a position (default "position"; pass null if none). */
  position?: string | null;
  orderBy?: string;
  /** jsonb columns that must be JSON.stringify'd on write. */
  json?: readonly string[];
  /** Foreign keys that must belong to the same project: camelCase column -> table. */
  fks?: Record<string, string>;
  /** Extra columns inserted on create, e.g. creator. */
  onCreate?: (ctx: import("./route.js").Ctx) => Record<string, any>;
  touch?: boolean;
}

const json = (cols: readonly string[] | undefined, row: Record<string, any>) => {
  for (const c of cols ?? []) {
    const k = c.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    if (row[k] !== undefined) row[k] = JSON.stringify(row[k]);
  }
  return row;
};

export function projectCrud(o: ProjectCrudOpts): RouteDef[] {
  const base = `/projects/:projectId/${o.segment}`;
  const posCol = o.position === undefined ? "position" : o.position;
  const order = o.orderBy ?? posCol ?? "created_at";
  const refs = o.fks ?? {};

  const checkFks = async (ctx: any, projectId: string, input: Record<string, any>) => {
    for (const [col, table] of Object.entries(refs)) await assertInProject(ctx, table, input[col], projectId, col);
  };

  return [
    route({
      name: `list${o.plural}`,
      method: "GET",
      path: base,
      description: `Lists ${o.plural.toLowerCase()} of a project, ordered by ${order}.`,
      request: z.object({ projectId: z.string() }),
      response: z.array(o.response),
      handler: async (ctx, { projectId }) => {
        const project = await resolveProject(ctx, projectId);
        const rows = await ctx.db.selectFrom(o.table as any).selectAll().where("project_id", "=", project.id).orderBy(order as any).execute();
        return toApiList(rows);
      },
    }),
    route({
      name: `create${o.entity}`,
      method: "POST",
      path: base,
      description: `Creates a ${o.entity.toLowerCase()} in a project.`,
      request: o.create.extend({ projectId: z.string() }),
      response: o.response,
      handler: async (ctx, input: any) => {
        const project = await resolveProject(ctx, input.projectId);
        await checkFks(ctx, project.id, input);
        const values: Record<string, any> = { id: ulid(), project_id: project.id, ...toColumns(input, o.columns), ...(o.onCreate?.(ctx) ?? {}) };
        if (posCol && input[posCol] === undefined) {
          const max = await ctx.db.selectFrom(o.table as any).select((eb: any) => eb.fn.max(posCol).as("m")).where("project_id", "=", project.id).executeTakeFirst();
          values[posCol] = Number((max as any)?.m ?? 0) + 1000;
        }
        const row = await ctx.db.insertInto(o.table as any).values(json(o.json, values)).returningAll().executeTakeFirstOrThrow();
        return toApi(row);
      },
    }),
    route({
      name: `update${o.entity}`,
      method: "PATCH",
      path: `${base}/:id`,
      description: `Updates a ${o.entity.toLowerCase()}.`,
      request: o.update.extend({ projectId: z.string(), id: z.string() }),
      response: o.response,
      handler: async (ctx, input: any) => {
        const project = await resolveProject(ctx, input.projectId);
        await checkFks(ctx, project.id, input);
        const patch = json(o.json, toColumns(input, o.columns));
        if (o.touch) patch.updated_at = new Date();
        const q = ctx.db.updateTable(o.table as any).where("id", "=", input.id).where("project_id", "=", project.id);
        const row = Object.keys(patch).length
          ? await q.set(patch).returningAll().executeTakeFirst()
          : await ctx.db.selectFrom(o.table as any).selectAll().where("id", "=", input.id).where("project_id", "=", project.id).executeTakeFirst();
        if (!row) throw notFound(`${o.entity.toLowerCase()}_not_found`);
        return toApi(row);
      },
    }),
    route({
      name: `delete${o.entity}`,
      method: "DELETE",
      path: `${base}/:id`,
      description: `Deletes a ${o.entity.toLowerCase()}.`,
      request: z.object({ projectId: z.string(), id: z.string() }),
      response: z.object({ ok: z.literal(true) }),
      handler: async (ctx, { projectId, id }) => {
        const project = await resolveProject(ctx, projectId);
        const res = await ctx.db.deleteFrom(o.table as any).where("id", "=", id).where("project_id", "=", project.id).executeTakeFirst();
        if (!Number(res.numDeletedRows)) throw notFound(`${o.entity.toLowerCase()}_not_found`);
        return { ok: true };
      },
    }),
  ];
}
