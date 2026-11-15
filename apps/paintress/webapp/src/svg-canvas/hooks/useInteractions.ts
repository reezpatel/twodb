import { useCallback, useEffect, useRef, useState } from "react";
import type { Item } from "@shared/model";
import { absPosition, type ItemMap } from "../../lib/item-store";
import type { Viewport } from "./useViewport";
import { absRect, distToDrawStroke, normRect, rectsIntersect, type Point, type Rect } from "../lib/geometry";

/** Canvas tools: pick on the left dock. pen/highlighter draw strokes; eraser removes them. */
export type CanvasTool = "select" | "hand" | "pen" | "highlighter" | "eraser";

/** What the pointer is doing. Discriminated so each handler only sees its own state. */
export type Gesture =
  | { kind: "idle" }
  | { kind: "maybe-move"; id: string; sx: number; sy: number; additive: boolean }
  | { kind: "maybe-pan"; sx: number; sy: number }
  | { kind: "maybe-create"; sx: number; sy: number }
  | { kind: "pan"; lastX: number; lastY: number }
  | { kind: "move"; start: Point; last: Point; ids: string[]; startPos: Map<string, Point> }
  | { kind: "resize"; id: string; handle: string; start: Point; startRect: Rect }
  | { kind: "connect"; fromId: string; fromHandle: string; fromWorld: Point; cursor: Point }
  | { kind: "marquee"; start: Point; cur: Point }
  | { kind: "create"; start: Point; cur: Point }
  | { kind: "draw"; pts: Point[] }
  | { kind: "erase"; erased: Set<string> };

export interface InteractionHandlers {
  panePointerDown(e: React.PointerEvent): void;
  nodePointerDown(e: React.PointerEvent, item: Item): void;
  handlePointerDown(e: React.PointerEvent, item: Item, handle: string): void;
  resizePointerDown(e: React.PointerEvent, item: Item, handle: string): void;
  nodeClick(e: React.MouseEvent, item: Item): void;
  edgeClick(e: React.MouseEvent, item: Item): void;
  paneClick(e: React.MouseEvent): void;
  pointerMove(e: React.PointerEvent): void;
}

export interface GestureResult {
  gesture: Gesture;
  dragDelta: Point | null; // live offset while moving (world units), applied to ids in the gesture
  resizeRect: Rect | null; // live rect for the resized id (world abs)
  connectLine: { from: Point; to: Point } | null;
  marquee: Rect | null; // world coords
  createRect: Rect | null; // world coords
  drawPoints: Point[] | null; // live freehand stroke (world coords)
  cursorWorld: Point | null; // cursor in world coords (armed preview)
  dropTargetId: string | null; // group/lane under a dragged item's centre
  handlers: InteractionHandlers;
}

const DRAG_THRESHOLD = 5;
const MIN_SIZE: Record<string, { w: number; h: number }> = {
  shape: { w: 24, h: 24 },
  group: { w: 120, h: 80 },
  pool: { w: 220, h: 120 },
  lane: { w: 200, h: 56 },
  entity: { w: 180, h: 56 },
  sticky: { w: 80, h: 60 },
  text: { w: 40, h: 20 },
  image: { w: 24, h: 24 },
  draw: { w: 2, h: 2 },
};

/**
 * Business hook: the pointer gesture state machine for the SVG canvas. Events
 * come from the SVG root and item <g> elements; each gesture streams live
 * visuals and commits exactly once on pointer-up through the injected callbacks.
 */
export function useInteractions(opts: {
  svgRef: React.RefObject<SVGSVGElement | null>;
  viewRef: React.RefObject<Viewport>;
  itemsRef: React.RefObject<ItemMap>;
  canEdit: boolean;
  tool: CanvasTool;
  spacePan: boolean; // Space held → pan with the primary button
  armed: boolean;
  selection: ReadonlySet<string>;
  setSelection(ids: string[]): void;
  moveEnded(ids: string[], abs: Map<string, Point>): void; // world abs top-left per id
  resizeEnded(id: string, rect: Rect): void; // world abs rect
  connectEnded(fromId: string, fromHandle: string, toId: string | null, toHandle: string | null): void;
  createEnded(rect: Rect | null, point: Point): void;
  drawEnded(points: Point[], tool: "pen" | "highlighter"): void;
  eraseHit(id: string): void; // fired live, once per stroke the eraser touches
}): GestureResult {
  const [gesture, setGesture] = useState<Gesture>({ kind: "idle" });
  const [cursorWorld, setCursorWorld] = useState<Point | null>(null);
  const o = useRef(opts);
  o.current = opts;
  const state = useRef<Gesture>({ kind: "idle" });

  const setG = useCallback((next: Gesture) => {
    state.current = next;
    setGesture(next);
  }, []);

  const local = useCallback((e: { clientX: number; clientY: number }): Point => {
    const r = o.current.svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  const toWorld = useCallback((screen: Point): Point => {
    const v = o.current.viewRef.current!;
    return { x: screen.x / v.zoom + v.x, y: screen.y / v.zoom + v.y };
  }, []);

  const pointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (o.current.armed && state.current.kind === "idle") setCursorWorld(toWorld(local(e)));
    },
    [local, toWorld],
  );

  /** Item under a world point: deepest (children before parents) non-edge hit. */
  const hitItem = useCallback((world: Point, exclude?: ReadonlySet<string>): Item | null => {
    const m = o.current.itemsRef.current!;
    let best: Item | null = null;
    let bestDepth = -1;
    for (const i of m.values()) {
      if (i.type === "edge" || exclude?.has(i.id)) continue;
      const r = absRect(m, i);
      if (world.x >= r.x && world.x <= r.x + r.width && world.y >= r.y && world.y <= r.y + r.height) {
        let depth = 0;
        let p = i.parentId;
        while (p) {
          depth++;
          p = m.get(p)?.parentId ?? null;
        }
        if (depth >= bestDepth) {
          bestDepth = depth;
          best = i;
        }
      }
    }
    return best;
  }, []);

  /** Erase the draw stroke under a world point (tolerance scales with zoom), once per stroke per gesture. */
  const eraseAt = useCallback((world: Point, erased: Set<string>) => {
    const m = o.current.itemsRef.current!;
    const tol = Math.max(6 / o.current.viewRef.current!.zoom, 4);
    for (const i of m.values()) {
      if (i.type !== "draw" || erased.has(i.id)) continue;
      const strokeTol = Math.max(tol, (((i.data as { width?: number }).width ?? 3) / 2) * Math.min(1, 2 / o.current.viewRef.current!.zoom));
      if (distToDrawStroke(m, i, world) <= strokeTol) {
        erased.add(i.id);
        o.current.eraseHit(i.id);
      }
    }
  }, []);

  const begin = useCallback(
    (gst: Gesture) => {
      setG(gst);
      const move = (e: PointerEvent) => {
        const cur = state.current;
        const screen = local(e);
        const world = toWorld(screen);

        if (cur.kind === "maybe-move" && Math.hypot(e.clientX - cur.sx, e.clientY - cur.sy) > DRAG_THRESHOLD) {
          const m = o.current.itemsRef.current!;
          let ids = o.current.selection.has(cur.id) ? [...o.current.selection] : [cur.id];
          if (!o.current.selection.has(cur.id)) o.current.setSelection([cur.id]);
          ids = ids.filter((id) => !m.get(id)?.locked && m.get(id)?.type !== "edge");
          const startPos = new Map<string, Point>();
          for (const id of ids) {
            const item = m.get(id);
            if (item) startPos.set(id, absPosition(m, item));
          }
          setG({ kind: "move", start: world, last: world, ids, startPos });
        } else if (cur.kind === "maybe-pan" && Math.hypot(e.clientX - cur.sx, e.clientY - cur.sy) > DRAG_THRESHOLD) {
          setG({ kind: "pan", lastX: e.clientX, lastY: e.clientY });
        } else if (cur.kind === "maybe-create" && Math.hypot(e.clientX - cur.sx, e.clientY - cur.sy) > DRAG_THRESHOLD) {
          setG({ kind: "create", start: world, cur: world });
        } else if (cur.kind === "pan") {
          o.current.svgRef.current?.dispatchEvent(new CustomEvent("pa-pan", { detail: { dx: e.clientX - cur.lastX, dy: e.clientY - cur.lastY } }));
          setG({ kind: "pan", lastX: e.clientX, lastY: e.clientY });
        } else if (cur.kind === "move") {
          setG({ ...cur, last: world });
        } else if (cur.kind === "resize") {
          const d = { x: world.x - cur.start.x, y: world.y - cur.start.y };
          const min = MIN_SIZE[o.current.itemsRef.current!.get(cur.id)?.type ?? "shape"] ?? { w: 24, h: 24 };
          const r = cur.startRect;
          let { x, y, width, height } = r;
          if (cur.handle.includes("e")) width = Math.max(min.w, r.width + d.x);
          if (cur.handle.includes("s")) height = Math.max(min.h, r.height + d.y);
          if (cur.handle.includes("w")) {
            width = Math.max(min.w, r.width - d.x);
            x = r.x + r.width - width;
          }
          if (cur.handle.includes("n")) {
            height = Math.max(min.h, r.height - d.y);
            y = r.y + r.height - height;
          }
          setG({ ...cur, startRect: { x, y, width, height } });
        } else if (cur.kind === "connect") {
          setG({ ...cur, cursor: world });
        } else if (cur.kind === "marquee") {
          setG({ ...cur, cur: world });
        } else if (cur.kind === "create") {
          setG({ ...cur, cur: world });
        } else if (cur.kind === "draw") {
          const lastPt = cur.pts[cur.pts.length - 1]!;
          if (Math.hypot(world.x - lastPt.x, world.y - lastPt.y) >= 1.5 / o.current.viewRef.current!.zoom) setG({ kind: "draw", pts: [...cur.pts, world] });
        } else if (cur.kind === "erase") {
          eraseAt(world, cur.erased);
        }
      };

      const up = (e: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        const cur = state.current;
        const world = toWorld(local(e));
        setG({ kind: "idle" });
        const oo = o.current;

        if (cur.kind === "move") {
          const dx = cur.last.x - cur.start.x;
          const dy = cur.last.y - cur.start.y;
          if (dx || dy) {
            const abs = new Map<string, Point>();
            for (const [id, p] of cur.startPos) abs.set(id, { x: p.x + dx, y: p.y + dy });
            oo.moveEnded(cur.ids, abs);
          }
        } else if (cur.kind === "resize") {
          oo.resizeEnded(cur.id, cur.startRect);
        } else if (cur.kind === "connect") {
          const target = hitItem(world);
          oo.connectEnded(cur.fromId, cur.fromHandle, target && target.id !== cur.fromId ? target.id : null, target ? "l" : null);
        } else if (cur.kind === "marquee") {
          const box = normRect(cur.start.x, cur.start.y, world.x, world.y);
          const m = oo.itemsRef.current!;
          const ids = [...m.values()].filter((i) => i.type !== "edge" && rectsIntersect(absRect(m, i), box)).map((i) => i.id);
          oo.setSelection(ids);
        } else if (cur.kind === "create") {
          oo.createEnded(normRect(cur.start.x, cur.start.y, world.x, world.y), cur.start);
        } else if (cur.kind === "draw") {
          const t = oo.tool === "highlighter" ? "highlighter" : "pen";
          if (cur.pts.length === 1) oo.drawEnded([cur.pts[0]!, { x: cur.pts[0]!.x + 0.5, y: cur.pts[0]!.y + 0.5 }], t);
          else oo.drawEnded(cur.pts, t);
        } else if (cur.kind === "maybe-create") {
          oo.createEnded(null, toWorld({ x: cur.sx - o.current.svgRef.current!.getBoundingClientRect().left, y: cur.sy - o.current.svgRef.current!.getBoundingClientRect().top }));
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [eraseAt, hitItem, local, setG, toWorld],
  );

  const panePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1 || e.button === 2 || o.current.tool === "hand" || (e.button === 0 && o.current.spacePan)) {
        e.preventDefault();
        begin({ kind: "maybe-pan", sx: e.clientX, sy: e.clientY });
        return;
      }
      if (e.button !== 0) return;
      const t = o.current.tool;
      if ((t === "pen" || t === "highlighter") && o.current.canEdit) {
        e.preventDefault();
        begin({ kind: "draw", pts: [toWorld(local(e))] });
        return;
      }
      if (t === "eraser" && o.current.canEdit) {
        e.preventDefault();
        const erased = new Set<string>();
        eraseAt(toWorld(local(e)), erased); // a bare click erases too
        begin({ kind: "erase", erased });
        return;
      }
      if (o.current.armed && o.current.canEdit) {
        e.preventDefault();
        begin({ kind: "maybe-create", sx: e.clientX, sy: e.clientY });
        return;
      }
      const world = toWorld(local(e));
      begin({ kind: "marquee", start: world, cur: world });
    },
    [begin, local, toWorld],
  );

  const nodePointerDown = useCallback(
    (e: React.PointerEvent, item: Item) => {
      if (e.button !== 0 || !o.current.canEdit) return;
      const t = o.current.tool;
      if (t === "pen" || t === "highlighter" || t === "eraser") return; // let it bubble to the pane handler
      e.stopPropagation();
      // An armed palette item wins over dragging a node: press anywhere starts the create.
      if (o.current.armed) {
        e.preventDefault();
        begin({ kind: "maybe-create", sx: e.clientX, sy: e.clientY });
        return;
      }
      begin({ kind: "maybe-move", id: item.id, sx: e.clientX, sy: e.clientY, additive: e.shiftKey });
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, item: Item, handle: string) => {
      if (e.button !== 0 || !o.current.canEdit) return;
      e.stopPropagation();
      e.preventDefault();
      const r = absRect(o.current.itemsRef.current!, item);
      const anchors: Record<string, Point> = {
        t: { x: r.x + r.width / 2, y: r.y },
        b: { x: r.x + r.width / 2, y: r.y + r.height },
        l: { x: r.x, y: r.y + r.height / 2 },
        r: { x: r.x + r.width, y: r.y + r.height / 2 },
      };
      const from = anchors[handle[0]!] ?? { x: r.x + r.width / 2, y: r.y };
      begin({ kind: "connect", fromId: item.id, fromHandle: handle, fromWorld: from, cursor: from });
    },
    [begin],
  );

  const resizePointerDown = useCallback(
    (e: React.PointerEvent, item: Item, handle: string) => {
      if (e.button !== 0 || !o.current.canEdit) return;
      e.stopPropagation();
      e.preventDefault();
      const r = absRect(o.current.itemsRef.current!, item);
      begin({ kind: "resize", id: item.id, handle, start: toWorld(local(e)), startRect: r });
    },
    [begin, local, toWorld],
  );

  const nodeClick = useCallback((e: React.MouseEvent, item: Item) => {
    e.stopPropagation();
    const sel = o.current.selection;
    if (e.shiftKey) {
      const next = new Set(sel);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      o.current.setSelection([...next]);
    } else if (!sel.has(item.id) || sel.size > 1) {
      o.current.setSelection([item.id]);
    }
  }, []);

  const edgeClick = useCallback((e: React.MouseEvent, item: Item) => {
    e.stopPropagation();
    o.current.setSelection([item.id]);
  }, []);

  const paneClick = useCallback((_e: React.MouseEvent) => {
    if (state.current.kind === "idle") o.current.setSelection([]);
  }, []);

  // Derived live visuals.
  const dragDelta = gesture.kind === "move" ? { x: gesture.last.x - gesture.start.x, y: gesture.last.y - gesture.start.y } : null;
  const resizeRect = gesture.kind === "resize" ? gesture.startRect : null;
  const connectLine = gesture.kind === "connect" ? { from: gesture.fromWorld, to: gesture.cursor } : null;
  const marquee = gesture.kind === "marquee" ? normRect(gesture.start.x, gesture.start.y, gesture.cur.x, gesture.cur.y) : null;
  const createRect = gesture.kind === "create" ? normRect(gesture.start.x, gesture.start.y, gesture.cur.x, gesture.cur.y) : null;
  const drawPoints = gesture.kind === "draw" ? gesture.pts : null;

  // Highlight the group/lane a dragged item would drop into.
  let dropTargetId: string | null = null;
  if (gesture.kind === "move" && dragDelta) {
    const m = o.current.itemsRef.current!;
    const moving = new Set(gesture.ids);
    const centre = (() => {
      const first = gesture.startPos.get(gesture.ids[0]!);
      const item = m.get(gesture.ids[0]!);
      if (!first || !item) return null;
      return { x: first.x + dragDelta.x + item.width / 2, y: first.y + dragDelta.y + item.height / 2 };
    })();
    const hit = centre ? hitItem(centre, moving) : null;
    if (hit && (hit.type === "group" || hit.type === "lane" || hit.type === "pool")) dropTargetId = hit.id;
  }

  return {
    gesture,
    dragDelta,
    resizeRect,
    connectLine,
    marquee,
    createRect,
    drawPoints,
    dropTargetId,
    cursorWorld,
    handlers: { panePointerDown, nodePointerDown, handlePointerDown, resizePointerDown, nodeClick, edgeClick, paneClick, pointerMove },
  };
}
