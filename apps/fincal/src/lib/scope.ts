import type { Ctx } from "./route.js";
import { badRequest, notFound } from "./http.js";

/** Every query is filtered by workspace + space. Spaces themselves live in the control-plane registry. */
export function scoped<Q extends { where: (...a: any[]) => Q }>(q: Q, ctx: Ctx, spaceId: string, table?: string): Q {
  const p = table ? `${table}.` : "";
  return q.where(`${p}workspace_id`, "=", ctx.workspaceId).where(`${p}space_id`, "=", spaceId);
}

/** Loads one row of `table` by id inside the space, or 404. */
export async function getOwned(ctx: Ctx, table: string, spaceId: string, id: string) {
  const row = await scoped(ctx.db.selectFrom(table as any).selectAll(), ctx, spaceId).where("id", "=", id).executeTakeFirst();
  if (!row) throw notFound(`${table}_not_found`);
  return row as Record<string, any>;
}

/** Asserts a referenced row (account, category, envelope…) belongs to the same space. */
export async function assertOwned(ctx: Ctx, table: string, spaceId: string, id: string | null | undefined, label = table) {
  if (!id) return;
  const row = await scoped(ctx.db.selectFrom(table as any).select("id"), ctx, spaceId).where("id", "=", id).executeTakeFirst();
  if (!row) throw badRequest(`${label} does not belong to this space`);
}

/** Resolves a row by id, finding its space (for routes addressed by bare id: still workspace-scoped). */
export async function getByIdInWorkspace(ctx: Ctx, table: string, id: string) {
  const row = await ctx.db.selectFrom(table as any).selectAll().where("workspace_id", "=", ctx.workspaceId).where("id", "=", id).executeTakeFirst();
  if (!row) throw notFound(`${table}_not_found`);
  return row as Record<string, any>;
}
