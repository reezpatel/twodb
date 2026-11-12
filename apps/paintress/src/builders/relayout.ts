// "Tidy up": re-run auto-layout over existing items and emit position updates.
import type { Item, Op } from "../shared/model.js";
import type { LayoutRequest } from "../shared/dto.js";
import { LAYOUT } from "../shared/shapes.js";
import { layoutGraph, type LEdge, type LNode } from "../layout.js";

export async function buildRelayout(req: LayoutRequest, items: Item[]): Promise<{ ops: Op[]; warnings: string[] }> {
  const warnings: string[] = [];
  const byId = new Map(items.map((i) => [i.id, i]));
  // Swimlane pools and their contents have their own geometry — leave them alone.
  const locked = new Set<string>();
  const markTree = (id: string) => {
    locked.add(id);
    for (const i of items) if (i.parentId === id && !locked.has(i.id)) markTree(i.id);
  };
  for (const i of items) if (i.type === "pool" || i.type === "lane") markTree(i.id);

  const scopeRoot = req.groupId ?? null;
  if (scopeRoot && byId.get(scopeRoot)?.type !== "group") return { ops: [], warnings: [`${scopeRoot} is not a group`] };

  const inScope = (i: Item): boolean => {
    if (locked.has(i.id) || i.type === "edge") return false;
    if (!scopeRoot) return true;
    for (let p = i.parentId; p; p = byId.get(p)?.parentId ?? null) if (p === scopeRoot) return true;
    return false;
  };
  const nodes = items.filter(inScope);
  const ids = new Set(nodes.map((n) => n.id));
  const lnodes: LNode[] = nodes.map((n) => ({
    id: n.id,
    width: n.width,
    height: n.height,
    parent: n.parentId === scopeRoot ? null : n.parentId,
    isGroup: n.type === "group",
  }));
  const ledges: LEdge[] = items
    .filter((i) => i.type === "edge")
    .map((e) => {
      const d = e.data as { from?: { itemId?: string }; to?: { itemId?: string } };
      return { id: e.id, from: d.from?.itemId ?? "", to: d.to?.itemId ?? "" };
    })
    .filter((e) => ids.has(e.from) && ids.has(e.to));

  const placed = await layoutGraph(lnodes, ledges, req.direction);
  const ops: Op[] = [];
  const offX = scopeRoot ? LAYOUT.groupPadding.left : 0;
  const offY = scopeRoot ? LAYOUT.groupPadding.top : 0;
  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    const p = placed.get(n.id);
    if (!p) continue;
    if (n.pinned && !req.includePinned) continue;
    const topLevel = n.parentId === scopeRoot;
    const x = p.x + (topLevel ? offX : 0);
    const y = p.y + (topLevel ? offY : 0);
    if (topLevel) {
      maxX = Math.max(maxX, x + p.width);
      maxY = Math.max(maxY, y + p.height);
    }
    ops.push({
      op: "update",
      id: n.id,
      patch: { x, y, ...(n.type === "group" ? { width: p.width, height: p.height } : {}) },
    });
  }
  if (scopeRoot) {
    const g = byId.get(scopeRoot)!;
    ops.push({
      op: "update",
      id: scopeRoot,
      patch: { width: Math.max(g.width, maxX + LAYOUT.groupPadding.right), height: Math.max(g.height, maxY + LAYOUT.groupPadding.bottom) },
    });
  }
  if (!ops.length) warnings.push("nothing to lay out (items are pinned, locked, or in swimlanes)");
  return { ops, warnings };
}
