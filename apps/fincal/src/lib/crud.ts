import { z, type ZodRawShape } from "zod";
import { ulid } from "ulid";
import { route, type Ctx, type RouteDef } from "./route.js";
import { getByIdInWorkspace, scoped } from "./scope.js";
import { snake, toApi, toApiList } from "./rows.js";
import { anyList, anyObject, ok, spaceId } from "../routes/schemas.js";

interface CrudOpts {
  /** Singular PascalCase, e.g. "Account" -> listAccounts/createAccount/… */
  singular: string;
  plural: string;
  table: string;
  path: string;
  shape: ZodRawShape;
  orderBy?: string;
  /** Table has created_by. */
  createdBy?: boolean;
  /** Table has archived_at: update accepts `archived`, list hides archived unless includeArchived. */
  archivable?: boolean;
  /** Skip generating the list route (custom list with computed fields). */
  noList?: boolean;
  /** Validate foreign references before insert/update. */
  check?: (ctx: Ctx, spaceId: string, data: Record<string, any>) => Promise<void>;
  describe: string;
}

/** Generates list/create/update/delete for a space-scoped table. Item routes are addressed by id, workspace-scoped. */
export function crud(o: CrudOpts): RouteDef[] {
  const toRow = (data: Record<string, any>) => {
    const row: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) if (v !== undefined) row[snake(k)] = v;
    return row;
  };
  const routes: RouteDef[] = [];
  if (!o.noList) {
    routes.push(route({
      name: `list${o.plural}`, method: "GET", path: o.path,
      description: `Lists ${o.describe} of a space.`,
      request: z.object({ spaceId, includeArchived: z.coerce.boolean().optional() }),
      response: anyList,
      handler: async (ctx, { spaceId: sid, includeArchived }) => {
        let q = scoped(ctx.db.selectFrom(o.table as any).selectAll(), ctx, sid).orderBy((o.orderBy ?? "created_at") as any);
        if (o.archivable && !includeArchived) q = q.where("archived_at", "is", null);
        return toApiList(await q.execute());
      },
    }));
  }
  routes.push(
    route({
      name: `create${o.singular}`, method: "POST", path: o.path,
      description: `Creates ${o.describe.replace(/s$/, "")} in a space.`,
      request: z.object({ spaceId, ...o.shape }), response: anyObject,
      handler: async (ctx, input: any) => {
        const { spaceId: sid, ...data } = input;
        await o.check?.(ctx, sid, data);
        const row = await ctx.db.insertInto(o.table as any)
          .values({ id: ulid(), workspace_id: ctx.workspaceId, space_id: sid, ...(o.createdBy ? { created_by: ctx.userId } : {}), ...toRow(data) })
          .returningAll().executeTakeFirstOrThrow();
        return toApi(row);
      },
    }),
    route({
      name: `update${o.singular}`, method: "PATCH", path: `${o.path}/:id`,
      description: `Updates ${o.describe.replace(/s$/, "")}.`,
      request: z.object({ id: z.string(), ...(z.object(o.shape).partial().shape), ...(o.archivable ? { archived: z.boolean().optional() } : {}) }),
      response: anyObject,
      handler: async (ctx, input: any) => {
        const { id, archived, ...data } = input;
        const existing = await getByIdInWorkspace(ctx, o.table, id);
        await o.check?.(ctx, existing.space_id, data);
        const patch = toRow(data);
        if (archived !== undefined) patch.archived_at = archived ? new Date() : null;
        if (!Object.keys(patch).length) return toApi(existing);
        const row = await ctx.db.updateTable(o.table as any).set(patch).where("id", "=", id).where("workspace_id", "=", ctx.workspaceId).returningAll().executeTakeFirstOrThrow();
        return toApi(row);
      },
    }),
    route({
      name: `delete${o.singular}`, method: "DELETE", path: `${o.path}/:id`,
      description: `Deletes ${o.describe.replace(/s$/, "")}. Fails with 409 if still referenced.`,
      request: z.object({ id: z.string() }), response: ok,
      handler: async (ctx, { id }) => {
        await getByIdInWorkspace(ctx, o.table, id);
        await ctx.db.deleteFrom(o.table as any).where("id", "=", id).where("workspace_id", "=", ctx.workspaceId).execute();
        return { ok: true };
      },
    }),
  );
  return routes;
}
