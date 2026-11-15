import { memo } from "react";
import type { Item } from "@shared/model";
import type { Rect } from "../lib/geometry";

/** Four connection points (t/r/b/l) on a node; visible on hover/selection/connecting. */
export const Handles = memo(function Handles({ item, rect, visible, onPointerDown }: { item: Item; rect: Rect; visible: boolean; onPointerDown(e: React.PointerEvent, item: Item, handle: string): void }) {
  const pts: [string, number, number][] = [
    ["t", rect.width / 2, 0],
    ["r", rect.width, rect.height / 2],
    ["b", rect.width / 2, rect.height],
    ["l", 0, rect.height / 2],
  ];
  return (
    <g className={`pa-svg-handles ${visible ? "pa-svg-handles-on" : ""}`}>
      {pts.map(([id, cx, cy]) => (
        <circle key={id} cx={cx} cy={cy} r={5} className="pa-svg-handle" onPointerDown={(e) => onPointerDown(e, item, id)} style={{ pointerEvents: visible ? "all" : "none" }} />
      ))}
    </g>
  );
});

/** Corner/edge resize grips for the selected node (sizes stay constant on screen across zoom). */
export const ResizeHandles = memo(function ResizeHandles({ item, rect, zoom, onPointerDown }: { item: Item; rect: Rect; zoom: number; onPointerDown(e: React.PointerEvent, item: Item, handle: string): void }) {
  const g = 8 / zoom; // screen px → world px
  const pts: [string, number, number, string][] = [
    ["nw", 0, 0, "nwse-resize"],
    ["n", rect.width / 2, 0, "ns-resize"],
    ["ne", rect.width, 0, "nesw-resize"],
    ["e", rect.width, rect.height / 2, "ew-resize"],
    ["se", rect.width, rect.height, "nwse-resize"],
    ["s", rect.width / 2, rect.height, "ns-resize"],
    ["sw", 0, rect.height, "nesw-resize"],
    ["w", 0, rect.height / 2, "ew-resize"],
  ];
  return (
    <g className="pa-svg-resize">
      {pts.map(([id, cx, cy, cursor]) => (
        <rect key={id} x={cx - g / 2} y={cy - g / 2} width={g} height={g} rx={g / 5} className="pa-svg-grip" strokeWidth={1.5 / zoom} style={{ cursor }} onPointerDown={(e) => onPointerDown(e, item, id)} />
      ))}
    </g>
  );
});
