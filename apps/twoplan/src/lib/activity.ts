import { ulid } from "ulid";
import type { Ctx } from "./route.js";

export async function logActivity(
  ctx: Ctx,
  ticketId: string,
  action: string,
  field?: string,
  oldValue?: unknown,
  newValue?: unknown,
) {
  await ctx.db
    .insertInto("ticket_activity")
    .values({
      id: ulid(),
      ticket_id: ticketId,
      user_id: ctx.userId,
      action,
      field: field ?? null,
      old_value: oldValue == null ? null : String(oldValue),
      new_value: newValue == null ? null : String(newValue),
    })
    .execute();
}

export async function addWatcher(ctx: Ctx, ticketId: string, userId: string | null) {
  if (!userId) return;
  await ctx.db.insertInto("ticket_watcher").values({ ticket_id: ticketId, user_id: userId }).onConflict((oc) => oc.doNothing()).execute();
}

/** In-app inbox only: one notification per watcher except the actor. */
export async function notifyWatchers(ctx: Ctx, ticketId: string, kind: string, message: string, extraUserIds: (string | null)[] = []) {
  const watchers = await ctx.db.selectFrom("ticket_watcher").select("user_id").where("ticket_id", "=", ticketId).execute();
  const ids = new Set<string>([...watchers.map((w) => w.user_id as string), ...(extraUserIds.filter(Boolean) as string[])]);
  if (ctx.userId) ids.delete(ctx.userId);
  if (!ids.size) return;
  await ctx.db
    .insertInto("notification")
    .values([...ids].map((user_id) => ({ id: ulid(), workspace_id: ctx.workspaceId, user_id, actor_user_id: ctx.userId, ticket_id: ticketId, kind, message })))
    .execute();
}
