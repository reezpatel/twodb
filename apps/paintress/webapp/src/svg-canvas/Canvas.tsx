import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Maximize } from "lucide-react";
import type { Item } from "@shared/model";
import { absPosition, sortForFlow, type ItemMap } from "../lib/item-store";
import { containerAt } from "../lib/containers";
import { absRect, strokePath, type Rect } from "./lib/geometry";
import { useViewport } from "./hooks/useViewport";
import { useInteractions, type CanvasTool } from "./hooks/useInteractions";
import { NodeView } from "./partials/NodeView";
import { EdgeView } from "./partials/EdgeView";
import { Handles, ResizeHandles } from "./partials/Handles";
import { Minimap } from "./partials/Minimap";
import { ArmedPreview } from "./partials/ArmedPreview";
import type { ArmedSpec } from "../board-diagram/hooks/usePlacement";

export interface CanvasCommands {
  moveEnded(ids: string[], abs: Map<string, { x: number; y: number }>): void;
  resizeEnded(id: string, rect: Rect): void;
  connect(fromId: string, fromHandle: string, toId: string | null, toHandle: string | null): void;
  createAt(rect: Rect | null, point: { x: number; y: number }): void;
  drawEnded(points: { x: number; y: number }[], tool: "pen" | "highlighter"): void;
  eraseHit(id: string): void;
}

export interface CanvasProps {
  items: ItemMap;
  canEdit: boolean;
  tool: CanvasTool;
  armed: ArmedSpec | null;
  penColor: string; // live preview stroke colour
  flash: ReadonlySet<string>;
  selection: string[];
  setSelection(ids: string[]): void;
  cmd: CanvasCommands;
  fitSignal: number; // bump to re-fit
}

/** The SVG canvas: one <svg>, world transformed by the viewport, all interactions as pointer gestures. */
export function Canvas(props: CanvasProps) {
  const vp = useViewport();
  const svgRef = useRef<SVGSVGElement>(null);
  const itemsRef = useRef(props.items);
  itemsRef.current = props.items;
  const [size, setSize] = useState({ width: 1200, height: 800 });
  const [spacePan, setSpacePan] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target as HTMLElement).closest("input, textarea, [contenteditable]")) {
        e.preventDefault();
        setSpacePan(true);
      }
    };
    const up = (e: KeyboardEvent) => e.code === "Space" && setSpacePan(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      vp.sizeRef.current = { width: r.width, height: r.height };
      setSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [vp]);

  // Pan gestures from the interaction hook land here as custom events.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onPan = (e: Event) => {
      const { dx, dy } = (e as CustomEvent).detail;
      vp.panBy(dx, dy);
    };
    el.addEventListener("pa-pan", onPan);
    return () => el.removeEventListener("pa-pan", onPan);
  }, [vp]);

  // Fit on first content and on demand.
  const fitted = useRef(false);
  const bounds = useMemo(() => contentBounds(props.items), [props.items]);
  useEffect(() => {
    if (!fitted.current && bounds) {
      fitted.current = true;
      setTimeout(() => vp.fitView(bounds), 50);
    }
  }, [bounds, vp]);
  useEffect(() => {
    if (props.fitSignal) vp.fitView(bounds);
  }, [props.fitSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  const inter = useInteractions({
    svgRef,
    viewRef: vp.viewRef,
    itemsRef,
    canEdit: props.canEdit,
    tool: props.tool,
    spacePan,
    armed: !!props.armed,
    selection: new Set(props.selection),
    setSelection: props.setSelection,
    moveEnded: props.cmd.moveEnded,
    resizeEnded: props.cmd.resizeEnded,
    connectEnded: props.cmd.connect,
    createEnded: props.cmd.createAt,
    drawEnded: props.cmd.drawEnded,
    eraseHit: props.cmd.eraseHit,
  });

  // Live map: in-flight drag/resize applied, so edges re-route while moving.
  const liveMap: ItemMap = useMemo(() => {
    if (!inter.dragDelta && !inter.resizeRect) return props.items;
    const next = new Map(props.items);
    if (inter.dragDelta && inter.gesture.kind === "move") {
      for (const id of inter.gesture.ids) {
        const item = next.get(id);
        if (!item) continue;
        const start = inter.gesture.startPos.get(id);
        if (!start) continue;
        // drag positions are absolute; convert back to parent-relative
        const parent = item.parentId ? next.get(item.parentId) : undefined;
        const base = parent ? absPosition(next, parent) : { x: 0, y: 0 };
        next.set(id, { ...item, x: start.x + inter.dragDelta.x - base.x, y: start.y + inter.dragDelta.y - base.y });
      }
    }
    if (inter.resizeRect && inter.gesture.kind === "resize") {
      const item = next.get(inter.gesture.id);
      if (item) {
        const r = inter.resizeRect;
        const parent = item.parentId ? next.get(item.parentId) : undefined;
        const base = parent ? absPosition(next, parent) : { x: 0, y: 0 };
        next.set(item.id, { ...item, x: r.x - base.x, y: r.y - base.y, width: r.width, height: r.height });
      }
    }
    return next;
  }, [props.items, inter.dragDelta, inter.resizeRect, inter.gesture]);

  const sorted = useMemo(() => sortForFlow([...liveMap.values()].filter((i) => i.type !== "edge")), [liveMap]);
  const edges = useMemo(() => [...liveMap.values()].filter((i) => i.type === "edge"), [liveMap]);
  const selectedSet = useMemo(() => new Set(props.selection), [props.selection]);
  const connecting = inter.gesture.kind === "connect";

  const v = vp.view;
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "var(--paper)" }}>
      <svg
        ref={svgRef}
        className={`h-full w-full touch-none select-none ${
          props.tool === "hand" || spacePan ? "cursor-grab" : props.armed ? "cursor-none" : props.tool === "pen" || props.tool === "highlighter" ? "cursor-crosshair" : props.tool === "eraser" ? "cursor-cell" : ""
        }`}
        onPointerDown={inter.handlers.panePointerDown}
        onPointerMove={inter.handlers.pointerMove}
        onClick={inter.handlers.paneClick}
        onWheel={vp.onWheel}
        role="application"
        aria-label="Diagram canvas"
      >
        <defs>
          <pattern id="pa-dots" width={24 * v.zoom} height={24 * v.zoom} patternUnits="userSpaceOnUse" x={-v.x * v.zoom} y={-v.y * v.zoom}>
            <circle cx={1.2} cy={1.2} r={Math.max(0.8, 1.2 * v.zoom * 0.8)} fill="var(--paper-grid)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pa-dots)" />
        <g transform={`scale(${v.zoom}) translate(${-v.x}, ${-v.y})`}>
          {edges.map((e) => (
            <EdgeView key={e.id} item={e} map={liveMap} selected={selectedSet.has(e.id)} onClick={inter.handlers.edgeClick} />
          ))}
          {sorted.map((item) => {
            const r = absRect(liveMap, item);
            return (
              <g key={item.id}>
                <NodeView
                  item={liveMap.get(item.id)!}
                  rect={r}
                  selected={selectedSet.has(item.id)}
                  hovered={false}
                  dropTarget={inter.dropTargetId === item.id}
                  flash={props.flash.has(item.id)}
                  onPointerDown={inter.handlers.nodePointerDown}
                  onClick={inter.handlers.nodeClick}
                />
                {(selectedSet.has(item.id) || connecting) && props.canEdit && (
                  <g transform={`translate(${r.x}, ${r.y})`}>
                    {item.type !== "pool" && item.type !== "lane" && (
                      <Handles item={item} rect={r} visible={connecting || selectedSet.has(item.id)} onPointerDown={inter.handlers.handlePointerDown} />
                    )}
                    {selectedSet.has(item.id) && !connecting && <ResizeHandles item={item} rect={r} zoom={v.zoom} onPointerDown={inter.handlers.resizePointerDown} />}
                  </g>
                )}
              </g>
            );
          })}
          {inter.connectLine && (
            <line x1={inter.connectLine.from.x} y1={inter.connectLine.from.y} x2={inter.connectLine.to.x} y2={inter.connectLine.to.y} stroke="var(--ion-deep)" strokeWidth={1.5} strokeDasharray="5 4" />
          )}
          {inter.marquee && <rect x={inter.marquee.x} y={inter.marquee.y} width={inter.marquee.width} height={inter.marquee.height} className="pa-svg-marquee" />}
          {inter.createRect && <rect x={inter.createRect.x} y={inter.createRect.y} width={inter.createRect.width} height={inter.createRect.height} className="pa-svg-create" />}
          {props.armed && inter.cursorWorld && !inter.createRect && <ArmedPreview spec={props.armed} at={inter.cursorWorld} />}
          {inter.drawPoints && (
            <path
              d={strokePath(inter.drawPoints.flatMap((p) => [p.x, p.y]))}
              fill="none"
              stroke={props.penColor}
              strokeWidth={props.tool === "highlighter" ? 16 : 3}
              strokeOpacity={props.tool === "highlighter" ? 0.4 : 1}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}
        </g>
      </svg>

      <div className="absolute bottom-3 left-3 flex flex-col gap-1 rounded-lg border border-outline bg-popover p-1 shadow-lg">
        <button type="button" aria-label="Zoom in" className="pa-zoombtn" onClick={() => vp.zoomAt({ x: size.width / 2, y: size.height / 2 }, 1.25)}>
          <Plus className="size-4" />
        </button>
        <div className="px-1 text-center text-[11px] text-ink-muted">{Math.round(v.zoom * 100)}%</div>
        <button type="button" aria-label="Zoom out" className="pa-zoombtn" onClick={() => vp.zoomAt({ x: size.width / 2, y: size.height / 2 }, 0.8)}>
          <Minus className="size-4" />
        </button>
        <button type="button" aria-label="Fit to screen" className="pa-zoombtn" onClick={() => vp.fitView(bounds)}>
          <Maximize className="size-4" />
        </button>
      </div>
      <div className="absolute bottom-3 right-3 rounded-lg border border-outline bg-popover shadow-lg">
        <Minimap
          map={props.items}
          viewport={v}
          viewportSize={size}
          onPan={(center) => vp.set({ x: center.x - size.width / v.zoom / 2, y: center.y - size.height / v.zoom / 2, zoom: v.zoom })}
        />
      </div>
    </div>
  );
}

function contentBounds(map: ItemMap): Rect | null {
  const items = [...map.values()].filter((i) => i.type !== "edge");
  if (!items.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const i of items) {
    const r = absRect(map, i);
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

