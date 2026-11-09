import { sql } from "kysely";
import { db } from "../../auth";
import { accessibleAccounts, EmailAccessError } from "./access";

// Local labels — nested via parentId + materialized id path ("root/child/id"),
// many-to-many with threads. Personal labels (accountId null) belong to their
// owner and work across accounts; shared-account labels are visible to every
// member of that account and only apply to its threads.

export const MAX_LABEL_DEPTH = 4;

export interface LabelPayload {
  id: string;
  parentId: string | null;
  accountId: string | null;
  name: string;
  color: string | null;
  effectiveColor: string | null;
  path: string;
  depth: number;
  position: number;
  /** Threads tagged with exactly this label. */
  total: number;
  unread: number;
  /** Including every descendant label. */
  rolledTotal: number;
  rolledUnread: number;
  mine: boolean;
}

async function visibleLabelRows(organizationId: string, userId: string) {
  const accountIds = [...(await accessibleAccounts(organizationId, userId)).keys()];
  return db
    .selectFrom("email_label")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where((eb) => {
      const personal = eb.and([eb("ownerUserId", "=", userId), eb("accountId", "is", null)]);
      return accountIds.length ? eb.or([personal, eb("accountId", "in", accountIds)]) : personal;
    })
    .orderBy("depth")
    .orderBy("position")
    .orderBy("name")
    .execute();
}

export async function visibleLabelIds(organizationId: string, userId: string): Promise<Set<string>> {
  return new Set((await visibleLabelRows(organizationId, userId)).map((l) => l.id));
}

export async function listLabels(organizationId: string, userId: string): Promise<LabelPayload[]> {
  const rows = await visibleLabelRows(organizationId, userId);
  const accountIds = [...(await accessibleAccounts(organizationId, userId)).keys()];
  const counts = rows.length && accountIds.length
    ? await db
        .selectFrom("email_thread_label")
        .innerJoin("email_thread", "email_thread.id", "email_thread_label.threadId")
        .select([
          "email_thread_label.labelId",
          sql<number>`count(*)::int`.as("total"),
          sql<number>`count(*) filter (where "email_thread"."unreadCount" > 0)::int`.as("unread"),
        ])
        .where("email_thread_label.labelId", "in", rows.map((r) => r.id))
        .where("email_thread.accountId", "in", accountIds)
        .where("email_thread.deletedAt", "is", null)
        .where("email_thread.purgedAt", "is", null)
        .where("email_thread.location", "!=", "spam")
        .groupBy("email_thread_label.labelId")
        .execute()
    : [];
  const byId = new Map(counts.map((c) => [c.labelId, c]));
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const effectiveColor = (id: string | null): string | null => {
    let cur = id ? rowById.get(id) : undefined;
    while (cur) {
      if (cur.color) return cur.color;
      cur = cur.parentId ? rowById.get(cur.parentId) : undefined;
    }
    return null;
  };

  return rows.map((r) => {
    const own = byId.get(r.id);
    let rolledTotal = 0;
    let rolledUnread = 0;
    for (const other of rows) {
      if (other.id === r.id || other.path.startsWith(`${r.path}/`)) {
        rolledTotal += byId.get(other.id)?.total ?? 0;
        rolledUnread += byId.get(other.id)?.unread ?? 0;
      }
    }
    return {
      id: r.id,
      parentId: r.parentId,
      accountId: r.accountId,
      name: r.name,
      color: r.color,
      effectiveColor: effectiveColor(r.id),
      path: r.path,
      depth: r.depth,
      position: r.position,
      total: own?.total ?? 0,
      unread: own?.unread ?? 0,
      rolledTotal,
      rolledUnread,
      mine: r.ownerUserId === userId,
    };
  });
}

async function requireLabel(organizationId: string, userId: string, labelId: string, write: boolean) {
  const label = await db.selectFrom("email_label").selectAll().where("id", "=", labelId).where("organizationId", "=", organizationId).executeTakeFirst();
  if (!label) throw new EmailAccessError(404, "label_not_found");
  if (label.accountId) {
    const role = (await accessibleAccounts(organizationId, userId)).get(label.accountId);
    if (!role) throw new EmailAccessError(404, "label_not_found");
    if (write && role === "viewer") throw new EmailAccessError(403, "forbidden");
  } else if (label.ownerUserId !== userId) {
    throw new EmailAccessError(404, "label_not_found");
  }
  return label;
}

/** Label ids for a label view — the label itself plus (optionally) its whole subtree. */
export async function labelSubtreeIds(organizationId: string, userId: string, labelId: string, includeChildren: boolean): Promise<string[]> {
  const label = await requireLabel(organizationId, userId, labelId, false);
  if (!includeChildren) return [label.id];
  const rows = await db
    .selectFrom("email_label")
    .select("id")
    .where("organizationId", "=", organizationId)
    .where((eb) => eb.or([eb("id", "=", label.id), eb("path", "like", `${label.path}/%`)]))
    .execute();
  return rows.map((r) => r.id);
}

function cleanName(name: unknown): string {
  if (typeof name !== "string") throw new EmailAccessError(400, "name_required");
  const trimmed = name.trim().replace(/\//g, "-").slice(0, 80);
  if (!trimmed) throw new EmailAccessError(400, "name_required");
  return trimmed;
}

async function assertUniqueSibling(organizationId: string, scope: { ownerUserId: string; accountId: string | null }, parentId: string | null, name: string, exceptId?: string) {
  let q = db
    .selectFrom("email_label")
    .select("id")
    .where("organizationId", "=", organizationId)
    .where(sql<boolean>`lower(name) = ${name.toLowerCase()}`);
  q = parentId ? q.where("parentId", "=", parentId) : q.where("parentId", "is", null);
  q = scope.accountId ? q.where("accountId", "=", scope.accountId) : q.where("accountId", "is", null).where("ownerUserId", "=", scope.ownerUserId);
  if (exceptId) q = q.where("id", "!=", exceptId);
  if (await q.executeTakeFirst()) throw new EmailAccessError(400, "label_exists");
}

export async function createLabel(
  organizationId: string,
  userId: string,
  input: { name: unknown; parentId?: string | null; accountId?: string | null; color?: string | null },
) {
  const name = cleanName(input.name);
  let accountId = input.accountId ?? null;
  let parentPath = "";
  let depth = 0;
  if (input.parentId) {
    const parent = await requireLabel(organizationId, userId, input.parentId, true);
    if (parent.depth >= MAX_LABEL_DEPTH) throw new EmailAccessError(400, "label_too_deep");
    accountId = parent.accountId;
    parentPath = parent.path;
    depth = parent.depth + 1;
  } else if (accountId) {
    const role = (await accessibleAccounts(organizationId, userId)).get(accountId);
    if (!role || role === "viewer") throw new EmailAccessError(403, "forbidden");
  }
  await assertUniqueSibling(organizationId, { ownerUserId: userId, accountId }, input.parentId ?? null, name);
  const id = crypto.randomUUID();
  const now = new Date();
  const siblings = await db
    .selectFrom("email_label")
    .select(sql<number>`coalesce(max(position), -1)::int`.as("max"))
    .where("organizationId", "=", organizationId)
    .where((eb) => (input.parentId ? eb("parentId", "=", input.parentId) : eb("parentId", "is", null)))
    .executeTakeFirst();
  await db
    .insertInto("email_label")
    .values({
      id,
      organizationId,
      ownerUserId: userId,
      accountId,
      parentId: input.parentId ?? null,
      path: parentPath ? `${parentPath}/${id}` : id,
      depth,
      name,
      color: input.color ?? null,
      position: (siblings?.max ?? -1) + 1,
      createdAt: now,
      updatedAt: now,
    })
    .execute();
  return id;
}

export async function updateLabel(
  organizationId: string,
  userId: string,
  labelId: string,
  patch: { name?: unknown; color?: string | null; parentId?: string | null; position?: number },
) {
  const label = await requireLabel(organizationId, userId, labelId, true);
  const now = new Date();
  if (patch.name !== undefined) {
    const name = cleanName(patch.name);
    await assertUniqueSibling(organizationId, { ownerUserId: label.ownerUserId, accountId: label.accountId }, label.parentId, name, label.id);
    await db.updateTable("email_label").set({ name, updatedAt: now }).where("id", "=", label.id).execute();
  }
  if (patch.color !== undefined) {
    await db.updateTable("email_label").set({ color: patch.color || null, updatedAt: now }).where("id", "=", label.id).execute();
  }
  if (patch.parentId !== undefined && patch.parentId !== label.parentId) {
    await moveLabel(organizationId, userId, label.id, patch.parentId);
  }
  if (typeof patch.position === "number") {
    await reorderLabel(label.id, patch.position);
  }
}

/** Reparents a label, rewriting path/depth of its whole subtree; rejects cycles and scope changes. */
async function moveLabel(organizationId: string, userId: string, labelId: string, parentId: string | null) {
  const label = await requireLabel(organizationId, userId, labelId, true);
  let newPath = label.id;
  let newDepth = 0;
  if (parentId) {
    const parent = await requireLabel(organizationId, userId, parentId, true);
    if (parent.id === label.id || parent.path.startsWith(`${label.path}/`)) throw new EmailAccessError(400, "label_cycle");
    if (parent.accountId !== label.accountId) throw new EmailAccessError(400, "label_scope_mismatch");
    newPath = `${parent.path}/${label.id}`;
    newDepth = parent.depth + 1;
  }
  const deepest = await db
    .selectFrom("email_label")
    .select(sql<number>`max(depth)::int`.as("max"))
    .where((eb) => eb.or([eb("id", "=", label.id), eb("path", "like", `${label.path}/%`)]))
    .executeTakeFirst();
  if ((deepest?.max ?? label.depth) - label.depth + newDepth > MAX_LABEL_DEPTH) throw new EmailAccessError(400, "label_too_deep");
  await assertUniqueSibling(organizationId, { ownerUserId: label.ownerUserId, accountId: label.accountId }, parentId, label.name, label.id);

  const oldPath = label.path;
  const delta = newDepth - label.depth;
  await db.transaction().execute(async (trx) => {
    await trx.updateTable("email_label").set({ parentId, updatedAt: new Date() }).where("id", "=", label.id).execute();
    await sql`
      update email_label
      set path = ${newPath} || substr(path, ${oldPath.length + 1}), depth = depth + ${delta}
      where "organizationId" = ${organizationId} and (path = ${oldPath} or path like ${`${oldPath}/%`})`.execute(trx);
  });
}

async function reorderLabel(labelId: string, position: number) {
  const label = await db.selectFrom("email_label").selectAll().where("id", "=", labelId).executeTakeFirstOrThrow();
  const siblings = await db
    .selectFrom("email_label")
    .select(["id"])
    .where("organizationId", "=", label.organizationId)
    .where((eb) => (label.parentId ? eb("parentId", "=", label.parentId) : eb("parentId", "is", null)))
    .where((eb) => (label.accountId ? eb("accountId", "=", label.accountId) : eb("accountId", "is", null)))
    .where("id", "!=", label.id)
    .orderBy("position")
    .orderBy("name")
    .execute();
  const order = siblings.map((s) => s.id);
  order.splice(Math.max(0, Math.min(position, order.length)), 0, label.id);
  await db.transaction().execute(async (trx) => {
    for (const [i, id] of order.entries()) await trx.updateTable("email_label").set({ position: i }).where("id", "=", id).execute();
  });
}

/** children=delete drops the subtree; children=reparent lifts direct children to this label's parent first. */
export async function deleteLabel(organizationId: string, userId: string, labelId: string, children: "delete" | "reparent") {
  const label = await requireLabel(organizationId, userId, labelId, true);
  if (children === "reparent") {
    const kids = await db.selectFrom("email_label").select("id").where("parentId", "=", label.id).execute();
    for (const kid of kids) await moveLabel(organizationId, userId, kid.id, label.parentId);
  }
  await db
    .deleteFrom("email_label")
    .where("organizationId", "=", organizationId)
    .where((eb) => eb.or([eb("id", "=", label.id), eb("path", "like", `${label.path}/%`)]))
    .execute();
}

/** Adds/removes labels on threads; enforces visibility and shared-label account scope. */
export async function applyLabels(organizationId: string, userId: string, threads: { id: string; accountId: string }[], add: string[], remove: string[]) {
  const visible = await visibleLabelRows(organizationId, userId);
  const byId = new Map(visible.map((l) => [l.id, l]));
  const now = new Date();
  for (const labelId of add) {
    const label = byId.get(labelId);
    if (!label) throw new EmailAccessError(404, "label_not_found");
    for (const t of threads) {
      if (label.accountId && label.accountId !== t.accountId) continue;
      await db
        .insertInto("email_thread_label")
        .values({ threadId: t.id, labelId, addedByUserId: userId, createdAt: now })
        .onConflict((oc) => oc.columns(["threadId", "labelId"]).doNothing())
        .execute();
    }
  }
  const removable = remove.filter((id) => byId.has(id));
  if (removable.length && threads.length) {
    await db
      .deleteFrom("email_thread_label")
      .where("threadId", "in", threads.map((t) => t.id))
      .where("labelId", "in", removable)
      .execute();
  }
}
