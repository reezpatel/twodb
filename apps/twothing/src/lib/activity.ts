import type { Kysely } from "@twodb/core-data/db";
import { ulid } from "ulid";
import type { ActivityRow, TwoThingDb } from "../db/schema.js";

export type ActivityAction = "created" | "updated" | "quantity" | "moved" | "labeled" | "deleted" | "imported";

export interface ActivityInput {
  targetKind: "item" | "location";
  targetId: string;
  targetName: string;
  action: ActivityAction;
  detail?: Record<string, unknown>;
}

export interface ActivityDto {
  id: string;
  targetKind: string;
  targetId: string;
  targetName: string;
  action: string;
  detail: Record<string, unknown>;
  userId: string | null;
  at: string;
}

export async function logActivity(db: Kysely<TwoThingDb>, workspaceId: string, userId: string | null, e: ActivityInput) {
  await db
    .insertInto("tt_activity")
    .values({
      id: ulid(),
      workspace_id: workspaceId,
      target_kind: e.targetKind,
      target_id: e.targetId,
      target_name: e.targetName,
      action: e.action,
      detail: JSON.stringify(e.detail ?? {}) as never,
      user_id: userId,
      at: new Date(),
    })
    .execute();
}

export const activityDto = (r: ActivityRow): ActivityDto => ({
  id: r.id,
  targetKind: r.target_kind,
  targetId: r.target_id,
  targetName: r.target_name,
  action: r.action,
  detail: r.detail ?? {},
  userId: r.user_id,
  at: new Date(r.at).toISOString(),
});

export async function readActivity(db: Kysely<TwoThingDb>, workspaceId: string, opts: { target?: string; limit?: number; before?: string } = {}) {
  let q = db.selectFrom("tt_activity").selectAll().where("workspace_id", "=", workspaceId);
  if (opts.target) q = q.where("target_id", "=", opts.target);
  if (opts.before) q = q.where("id", "<", opts.before);
  const rows = await q
    .orderBy("id", "desc")
    .limit(Math.min(Math.max(opts.limit ?? 50, 1), 200))
    .execute();
  return rows.map(activityDto);
}
