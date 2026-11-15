import { memo, useMemo } from "react";
import type { Item } from "@shared/model";
import { type ItemMap } from "../../lib/item-store";
import { absRect, type Rect } from "../lib/geometry";
import type { Viewport } from "../hooks/useViewport";

const W = 180;
const H = 120;

/** Miniature of the whole board; the rectangle is the current viewport. Drag/click to pan. */
export const Minimap = memo(function Minimap({ map, viewport, viewportSize, onPan }: { map: ItemMap; viewport: Viewport; viewportSize: { width: number; height: number }; onPan(center: { x: number; y: number }): void }) {
  const { bounds, scale } = useMemo(() => {
    const rects = [...map.values()].filter((i) => i.type !== "edge").map((i) => absRect(map, i));
    const acc = { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity };
    for (const r of rects) {
      acc.x = Math.min(acc.x, r.x);
      acc.y = Math.min(acc.y, r.y);
      acc.x2 = Math.max(acc.x2, r.x + r.width);
      acc.y2 = Math.max(acc.y2, r.y + r.height);
    }
    const b = rects.length ? acc : { x: 0, y: 0, x2: 800, y2: 600 };
    const bw = Math.max(400, b.x2 - b.x) + 100;
    const bh = Math.max(300, b.y2 - b.y) + 100;
    const scale = Math.min(W / bw, H / bh);
    return { bounds: { x: b.x - 50, y: b.y - 50 }, scale };
  }, [map]);

  const toMini = (r: { x: number; y: number; width: number; height: number }) => ({ x: (r.x - bounds.x) * scale, y: (r.y - bounds.y) * scale, w: r.width * scale, h: r.height * scale });
  const viewRect = toMini({ x: viewport.x, y: viewport.y, width: viewportSize.width / viewport.zoom, height: viewportSize.height / viewport.zoom });

  const jump = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onPan({ x: (e.clientX - r.left) / scale + bounds.x, y: (e.clientY - r.top) / scale + bounds.y });
  };

  return (
    <svg width={W} height={H} className="pa-minimap" onPointerDown={(e) => { e.stopPropagation(); jump(e); }} onPointerMove={(e) => e.buttons === 1 && jump(e)}>
      <rect width={W} height={H} className="pa-minimap-bg" />
      {[...map.values()]
        .filter((i) => i.type !== "edge")
        .map((i) => {
          const r = toMini(absRect(map, i));
          return <rect key={i.id} x={r.x} y={r.y} width={Math.max(1.5, r.w)} height={Math.max(1.5, r.h)} className={`pa-minimap-node pa-minimap-${i.type}`} />;
        })}
      <rect x={viewRect.x} y={viewRect.y} width={Math.max(6, viewRect.w)} height={Math.max(6, viewRect.h)} className="pa-minimap-view" />
    </svg>
  );
});
