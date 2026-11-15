// Geometry helpers shared by the SVG canvas and the command layer. Pure, so they can be tested without a browser.
import type { Item } from "@shared/model";
import { absPosition, type ItemMap } from "./item-store";

export type Side = "t" | "r" | "b" | "l";

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

/** React Flow handle id → the column id stored on the edge (entity rows), or undefined for plain side handles. */
export function handleToColumn(handle: string | null | undefined): string | undefined {
  if (!handle || isSide(handle)) return undefined;
  return handle.replace(/:(l|r)$/, "");
}
