import { sql } from "kysely";
import { db } from "../auth";
import type { NoteKind, NoteNode } from "../plugins/db";

export type { NoteNode };

export async function getNode(organizationId: string, id: string, opts: { includeDeleted?: boolean } = {}): Promise<NoteNode | null> {
  let q = db.selectFrom("note_node").selectAll().where("id", "=", id).where("organizationId", "=", organizationId);
  if (!opts.includeDeleted) q = q.where("deletedAt", "is", null);
  return (await q.executeTakeFirst()) ?? null;
}

export async function nextPosition(organizationId: string, parentId: string | null): Promise<number> {
  let q = db
    .selectFrom("note_node")
    .select((eb) => eb.fn.max("position").as("max"))
    .where("organizationId", "=", organizationId);
  q = parentId === null ? q.where("parentId", "is", null) : q.where("parentId", "=", parentId);
  const row = await q.executeTakeFirst();
  return (row?.max ?? -1) + 1;
}

/** A page's doc is "empty" when it holds nothing but empty paragraphs — the
 *  only state in which it may still be turned into a database. */
export function isEmptyContent(content: unknown): boolean {
  if (!content || typeof content !== "object") return true;
  const doc = (content as { doc?: unknown }).doc;
  if (!doc || typeof doc !== "object") return true;
  const nodes = (doc as { content?: unknown[] }).content ?? [];
  return nodes.every((n) => {
    const node = n as { type?: string; content?: unknown[] };
    return node.type === "paragraph" && (!node.content || node.content.length === 0);
  });
}

/** Ids of `rootId` and every descendant *page*. Descent stops at databases:
 *  deleting a page never deletes a database — it becomes dangling instead. */
export async function pageSubtreeIds(organizationId: string, rootId: string): Promise<string[]> {
  const out = [rootId];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = await db
      .selectFrom("note_node")
      .select("id")
      .where("organizationId", "=", organizationId)
      .where("parentId", "in", frontier)
      .where("kind", "=", "page")
      .where("deletedAt", "is", null)
      .execute();
    frontier = children.map((c) => c.id);
    out.push(...frontier);
  }
  return out;
}

/** Soft-deletes a node. Sections/pages take their page subtree with them
 *  (one shared timestamp so restore can bring back exactly that batch);
 *  databases are only ever soft-deleted themselves. */
export async function softDelete(organizationId: string, node: NoteNode): Promise<Date> {
  const deletedAt = new Date();
  const ids = node.kind === "database" ? [node.id] : await pageSubtreeIds(organizationId, node.id);
  await db.updateTable("note_node").set({ deletedAt, updatedAt: deletedAt }).where("organizationId", "=", organizationId).where("id", "in", ids).execute();
  return deletedAt;
}

/** Restores the node plus everything deleted in the same batch beneath it. */
export async function restore(organizationId: string, node: NoteNode) {
  const batch = node.deletedAt;
  if (!batch) return;
  const ids = [node.id];
  let frontier = [node.id];
  while (frontier.length > 0) {
    const children = await db
      .selectFrom("note_node")
      .select("id")
      .where("organizationId", "=", organizationId)
      .where("parentId", "in", frontier)
      .where("deletedAt", "=", batch)
      .execute();
    frontier = children.map((c) => c.id);
    ids.push(...frontier);
  }
  await db.updateTable("note_node").set({ deletedAt: null, updatedAt: new Date() }).where("organizationId", "=", organizationId).where("id", "in", ids).execute();
}

/** Ancestor chain (root first) for breadcrumbs. */
export async function ancestors(organizationId: string, node: NoteNode) {
  const chain: { id: string; kind: NoteKind; title: string; icon: string | null }[] = [];
  let parentId = node.parentId;
  for (let depth = 0; parentId && depth < 64; depth++) {
    const parent = await db
      .selectFrom("note_node")
      .select(["id", "kind", "title", "icon", "parentId"])
      .where("id", "=", parentId)
      .where("organizationId", "=", organizationId)
      .executeTakeFirst();
    if (!parent) break;
    chain.unshift({ id: parent.id, kind: parent.kind, title: parent.title, icon: parent.icon });
    parentId = parent.parentId;
  }
  return chain;
}

/** True when `candidateId` is `nodeId` or one of its descendants (move guard). */
export async function isSelfOrDescendant(organizationId: string, nodeId: string, candidateId: string): Promise<boolean> {
  let current: string | null = candidateId;
  for (let depth = 0; current && depth < 64; depth++) {
    if (current === nodeId) return true;
    const row: { parentId: string | null } | undefined = await db
      .selectFrom("note_node")
      .select("parentId")
      .where("id", "=", current)
      .where("organizationId", "=", organizationId)
      .executeTakeFirst();
    current = row?.parentId ?? null;
  }
  return false;
}

/** SQL fragment: an inline database whose block is no longer in its parent
 *  page's content (the block was removed → database is dangling). */
export const detachedInlineSql = (node: string, parent: string) =>
  sql<boolean>`(${sql.ref(`${node}.inline`)} AND ${sql.ref(`${parent}.id`)} IS NOT NULL AND position(${sql.ref(`${node}.id`)} in coalesce(${sql.ref(`${parent}.content`)}::text, '')) = 0)`;
