// Pure reducers over the client's copy of a board. The server is the source of
// truth; these mirror its semantics so edits can be shown optimistically.
import type { BoardEvent, Item, NewItem, Op } from "@shared/model";

export type ItemMap = ReadonlyMap<string, Item>;

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26);
}

function materialize(n: NewItem, boardId: string, actor: string): Item {
  const now = new Date().toISOString();
  return {
    id: n.id ?? newId(),
    boardId,
    key: n.key ?? null,
    type: n.type,
    parentId: n.parentId ?? null,
    x: n.x ?? 0,
    y: n.y ?? 0,
    width: n.width ?? 0,
    height: n.height ?? 0,
    zIndex: n.zIndex ?? Date.now() / 1000,
    locked: n.locked ?? false,
    pinned: n.pinned ?? false,
    version: 1,
    data: n.data ?? {},
    createdBy: actor,
    updatedBy: actor,
    createdAt: now,
    updatedAt: now,
  };
}

/** Everything the server would delete along with `id`: descendants and attached edges. */
export function cascade(map: ItemMap, id: string): Set<string> {
  const doomed = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const i of map.values()) {
      if (doomed.has(i.id)) continue;
      const d = i.data as { from?: { itemId?: string }; to?: { itemId?: string } };
      if (
        (i.parentId && doomed.has(i.parentId)) ||
        (i.type === "edge" && ((d.from?.itemId && doomed.has(d.from.itemId)) || (d.to?.itemId && doomed.has(d.to.itemId))))
      ) {
        doomed.add(i.id);
        grew = true;
      }
    }
  }
  return doomed;
}

export function applyOpsLocal(map: ItemMap, ops: Op[], boardId: string, actor: string): Map<string, Item> {
  const next = new Map(map);
  for (const op of ops) {
    if (op.op === "create") {
      const item = materialize(op.item, boardId, actor);
      const prev = next.get(item.id);
      next.set(item.id, prev ? { ...item, version: prev.version + 1 } : item);
    } else if (op.op === "update") {
      const cur = next.get(op.id);
      if (!cur) continue;
      const { data, ...scalars } = op.patch;
      const merged: Record<string, unknown> = { ...cur.data };
      for (const [k, v] of Object.entries(data ?? {})) {
        if (v === null) delete merged[k];
        else merged[k] = v;
      }
      next.set(op.id, { ...cur, ...stripUndefined(scalars), data: merged });
    } else {
      for (const id of cascade(next, op.id)) next.delete(id);
    }
  }
  return next;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Idempotent: safe to apply an event twice or out of order (per-item version wins). */
export function applyEvent(map: ItemMap, ev: Pick<BoardEvent, "upserts" | "deletes">): Map<string, Item> {
  const next = new Map(map);
  for (const u of ev.upserts) {
    const cur = next.get(u.id);
    if (!cur || u.version >= cur.version) next.set(u.id, u);
  }
  for (const id of ev.deletes) next.delete(id);
  return next;
}

/** After our own batch is acked, adopt the server's versions without touching positions we may have moved since. */
export function adoptVersions(map: ItemMap, upserts: Item[]): Map<string, Item> {
  const next = new Map(map);
  for (const u of upserts) {
    const cur = next.get(u.id);
    if (cur && u.version > cur.version) next.set(u.id, { ...cur, version: u.version });
  }
  return next;
}

/** Absolute position of an item (parents accumulate). */
export function absPosition(map: ItemMap, item: Item): { x: number; y: number } {
  let x = item.x;
  let y = item.y;
  for (let p = item.parentId ? map.get(item.parentId) : undefined; p; p = p.parentId ? map.get(p.parentId) : undefined) {
    x += p.x;
    y += p.y;
  }
  return { x, y };
}

/** Parents before children (React Flow requires it), edges excluded. */
export function sortForFlow(items: Item[]): Item[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: Item[] = [];
  const seen = new Set<string>();
  const visit = (i: Item) => {
    if (seen.has(i.id)) return;
    seen.add(i.id);
    const p = i.parentId ? byId.get(i.parentId) : undefined;
    if (p) visit(p);
    out.push(i);
  };
  items.forEach(visit);
  return out;
}

export function depthOf(map: ItemMap, item: Item): number {
  let d = 0;
  for (let p = item.parentId ? map.get(item.parentId) : undefined; p; p = p.parentId ? map.get(p.parentId) : undefined) d++;
  return d;
}
