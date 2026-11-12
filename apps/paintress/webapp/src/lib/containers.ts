import type { Item, NewItem, Op } from "@shared/model";
import { absPosition, depthOf, newId, type ItemMap } from "./item-store";

const CONTAINERS = new Set(["group", "lane"]);

function isDescendant(map: ItemMap, item: Item, ancestorId: string): boolean {
  for (let p = item.parentId ? map.get(item.parentId) : undefined; p; p = p.parentId ? map.get(p.parentId) : undefined) {
    if (p.id === ancestorId) return true;
  }
  return false;
}

/** Deepest group/lane whose box contains the absolute point, ignoring `exclude` and anything inside it. */
export function containerAt(map: ItemMap, point: { x: number; y: number }, exclude: ReadonlySet<string>): Item | null {
  let best: Item | null = null;
  let bestDepth = -1;
  for (const c of map.values()) {
    if (!CONTAINERS.has(c.type) || exclude.has(c.id)) continue;
    if ([...exclude].some((id) => isDescendant(map, c, id))) continue;
    const a = absPosition(map, c);
    if (point.x < a.x || point.y < a.y || point.x > a.x + c.width || point.y > a.y + c.height) continue;
    const depth = depthOf(map, c);
    if (depth > bestDepth) {
      best = c;
      bestDepth = depth;
    }
  }
  return best;
}

/** Items → create ops for fresh copies (new ids), shifted by `offset`. Edges are copied only when both ends are copied. */
export function cloneOps(map: ItemMap, items: Item[], offset: { x: number; y: number }): { ops: Op[]; ids: string[] } {
  const inSet = new Map(items.map((i) => [i.id, i]));
  // Pull in descendants so duplicating a group duplicates its contents.
  for (const i of map.values()) if (!inSet.has(i.id) && [...inSet.keys()].some((id) => isDescendant(map, i, id))) inSet.set(i.id, i);
  const idMap = new Map([...inSet.keys()].map((id) => [id, newId()]));
  const nodes = [...inSet.values()].filter((i) => i.type !== "edge");
  const ordered: Item[] = [];
  const seen = new Set<string>();
  const visit = (i: Item) => {
    if (seen.has(i.id)) return;
    seen.add(i.id);
    const p = i.parentId ? inSet.get(i.parentId) : undefined;
    if (p) visit(p);
    ordered.push(i);
  };
  nodes.forEach(visit);

  const ops: Op[] = [];
  for (const i of ordered) {
    const parentCopied = !!i.parentId && inSet.has(i.parentId);
    const n: NewItem = {
      id: idMap.get(i.id)!,
      type: i.type,
      parentId: parentCopied ? idMap.get(i.parentId!)! : i.parentId,
      x: i.x + (parentCopied ? 0 : offset.x),
      y: i.y + (parentCopied ? 0 : offset.y),
      width: i.width,
      height: i.height,
      locked: false,
      pinned: true,
      data: structuredClone(i.data),
    };
    ops.push({ op: "create", item: n });
  }
  // Every edge whose two ends are both being copied comes along (selected or not).
  const candidates = new Map<string, Item>();
  for (const e of [...map.values(), ...inSet.values()]) if (e.type === "edge") candidates.set(e.id, e);
  for (const e of candidates.values()) {
    const d = e.data as { from?: { itemId: string }; to?: { itemId: string } };
    const f = d.from && inSet.has(d.from.itemId) ? idMap.get(d.from.itemId) : undefined;
    const t = d.to && inSet.has(d.to.itemId) ? idMap.get(d.to.itemId) : undefined;
    if (!f || !t) continue;
    idMap.set(e.id, idMap.get(e.id) ?? newId());
    const data = structuredClone(e.data) as Record<string, unknown>;
    data.from = { ...(d.from as object), itemId: f };
    data.to = { ...(d.to as object), itemId: t };
    ops.push({ op: "create", item: { id: idMap.get(e.id)!, type: "edge", x: 0, y: 0, data } });
  }
  return { ops, ids: ops.filter((o) => o.op === "create" && o.item.type !== "edge").map((o) => (o as { item: { id: string } }).item.id) };
}
