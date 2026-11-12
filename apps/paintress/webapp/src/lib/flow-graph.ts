// Items → React Flow nodes/edges. Pure, so it can be tested without a browser.
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { EdgeData, Item } from "@shared/model";
import { absPosition, depthOf, sortForFlow, type ItemMap } from "./item-store";

type Side = "t" | "r" | "b" | "l";
const OPPOSITE: Record<Side, Side> = { t: "b", b: "t", l: "r", r: "l" };

function center(map: ItemMap, i: Item): { x: number; y: number } {
  const a = absPosition(map, i);
  return { x: a.x + i.width / 2, y: a.y + i.height / 2 };
}

/** Which side of `from` faces `to`. */
export function facing(map: ItemMap, from: Item, to: Item): Side {
  const a = center(map, from);
  const b = center(map, to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "r" : "l";
  return dy >= 0 ? "b" : "t";
}

const isSide = (h?: string): h is Side => h === "t" || h === "r" || h === "b" || h === "l";

/** Handle ids for one end of an edge: entity columns use `<column>:<l|r>`, everything else t/r/b/l. */
export function endHandle(item: Item, explicit: string | undefined, side: Side): string {
  if (item.type === "entity") {
    if (explicit && !isSide(explicit)) return `${explicit}:${side === "l" ? "l" : "r"}`;
    return "t";
  }
  return isSide(explicit) ? explicit : side;
}

export function toFlowNodes(map: ItemMap, prev: Node[], flash: ReadonlySet<string>): Node[] {
  const before = new Map(prev.map((n) => [n.id, n]));
  const items = sortForFlow([...map.values()].filter((i) => i.type !== "edge"));
  return items.map((item) => {
    const old = before.get(item.id);
    const busy = old?.dragging || (old as { resizing?: boolean } | undefined)?.resizing;
    return {
      id: item.id,
      type: item.type,
      position: busy && old ? old.position : { x: item.x, y: item.y },
      ...(item.parentId && map.has(item.parentId) ? { parentId: item.parentId } : {}),
      ...(item.width && item.height ? { width: busy && old?.width ? old.width : item.width, height: busy && old?.height ? old.height : item.height } : {}),
      zIndex: depthOf(map, item),
      selected: old?.selected ?? false,
      dragging: old?.dragging ?? false,
      draggable: !item.locked,
      data: { item, flash: flash.has(item.id) },
    } as Node;
  });
}

export function toFlowEdges(map: ItemMap, prev: Edge[]): Edge[] {
  const before = new Map(prev.map((e) => [e.id, e]));
  const out: Edge[] = [];
  for (const item of map.values()) {
    if (item.type !== "edge") continue;
    const d = item.data as Partial<EdgeData>;
    const from = d.from && map.get(d.from.itemId);
    const to = d.to && map.get(d.to.itemId);
    if (!d.from || !d.to || !from || !to) continue;
    const side = facing(map, from, to);
    const color = d.stroke ?? "#475569";
    out.push({
      id: item.id,
      type: "smart",
      source: from.id,
      target: to.id,
      sourceHandle: endHandle(from, d.from.handle, side),
      targetHandle: endHandle(to, d.to.handle, OPPOSITE[side]),
      selected: before.get(item.id)?.selected ?? false,
      markerEnd: d.endCap === "none" || d.cardinality ? undefined : { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
      markerStart: d.startCap === "arrow" ? { type: MarkerType.ArrowClosed, color, width: 18, height: 18 } : undefined,
      data: { item },
    });
  }
  return out;
}

/** React Flow handle id → the column id stored on the edge (entity rows), or undefined for plain side handles. */
export function handleToColumn(handle: string | null | undefined): string | undefined {
  if (!handle || isSide(handle)) return undefined;
  return handle.replace(/:(l|r)$/, "");
}
