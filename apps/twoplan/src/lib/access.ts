import type { Ctx } from "./route.js";
import { notFound, badRequest } from "./http.js";

export interface ProjectRow {
  id: string;
  workspace_id: string;
  space_id: string;
  key: string;
  name: string;
  [k: string]: any;
}

/** Workspace-level access: any member of the workspace may touch any project in it. */
export async function resolveProject(ctx: Ctx, ref: string): Promise<ProjectRow> {
  const row = await ctx.db
    .selectFrom("project")
    .selectAll()
    .where("workspace_id", "=", ctx.workspaceId)
    .where((eb) => eb.or([eb("id", "=", ref), eb("key", "=", ref.toUpperCase())]))
    .executeTakeFirst();
  if (!row) throw notFound("project_not_found");
  return row as ProjectRow;
}

const IDENT = /^([A-Za-z][A-Za-z0-9]*)-(\d+)$/;

/** Accepts a ticket id or a human identifier like `PLAN-42`. */
export async function resolveTicket(ctx: Ctx, ref: string) {
  const m = IDENT.exec(ref);
  let q = ctx.db
    .selectFrom("ticket")
    .innerJoin("project", "project.id", "ticket.project_id")
    .selectAll("ticket")
    .select(["project.key as project_key", "project.workspace_id as workspace_id", "project.name as project_name"])
    .where("project.workspace_id", "=", ctx.workspaceId);
  q = m
    ? q.where("project.key", "=", m[1].toUpperCase()).where("ticket.sequence_number", "=", Number(m[2]))
    : q.where("ticket.id", "=", ref);
  const row = await q.executeTakeFirst();
  if (!row) throw notFound("ticket_not_found");
  return row as unknown as Record<string, any> & { id: string; project_id: string; project_key: string; sequence_number: number; title: string };
}

/** Asserts a child row (by table + id) belongs to the given project. */
export async function assertInProject(ctx: Ctx, table: string, id: string | null | undefined, projectId: string, label = table) {
  if (!id) return;
  const row = await ctx.db.selectFrom(table as any).select("id").where("id", "=", id).where("project_id", "=", projectId).executeTakeFirst();
  if (!row) throw badRequest(`${label} does not belong to this project`);
}

export const identifier = (t: { project_key: string; sequence_number: number }) => `${t.project_key}-${t.sequence_number}`;
