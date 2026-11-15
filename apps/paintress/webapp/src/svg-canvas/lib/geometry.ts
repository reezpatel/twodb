import type { EdgeData, Item } from "@shared/model";
import { absPosition, type ItemMap } from "../../lib/item-store";
import { facing, endHandle, type Side } from "../../lib/flow-graph";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Point {
  x: number;
  y: number;
}

export const absRect = (map: ItemMap, i: Item): Rect => {
  const p = absPosition(map, i);
  return { x: p.x, y: p.y, width: i.width, height: i.height };
};

/** Anchor point of one edge end on its node (world coords) + outward direction. */
export function edgeAnchor(map: ItemMap, item: Item, handle: string | undefined, other: Item): { p: Point; dir: Point; side: Side } {
  const r = absRect(map, item);
  const side = facing(map, item, other);
  // Entity column handles: `<columnId>:l|r` — anchor on that row's edge.
  if (item.type === "entity" && handle && !["t", "r", "b", "l"].includes(handle)) {
    const colId = handle.replace(/:(l|r)$/, "");
    const lr = handle.endsWith(":l") ? "l" : "r";
    const cols = ((item.data as { columns?: { id: string }[] }).columns ?? []).findIndex((c) => c.id === colId);
    const y = r.y + 32 + (cols < 0 ? 0 : cols) * 24 + 12; // header 32, rows 24
    const x = lr === "l" ? r.x : r.x + r.width;
    return { p: { x, y }, dir: lr === "l" ? { x: -1, y: 0 } : { x: 1, y: 0 }, side: lr as Side };
  }
  const s: Side = handle && ["t", "r", "b", "l"].includes(handle) ? (handle as Side) : side;
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const anchors: Record<Side, { p: Point; dir: Point }> = {
    t: { p: { x: cx, y: r.y }, dir: { x: 0, y: -1 } },
    b: { p: { x: cx, y: r.y + r.height }, dir: { x: 0, y: 1 } },
    l: { p: { x: r.x, y: cy }, dir: { x: -1, y: 0 } },
    r: { p: { x: r.x + r.width, y: cy }, dir: { x: 1, y: 0 } },
  };
  return { ...anchors[s], side: s };
}

const OFF = 28;

/**
 * Orthogonal edge path with rounded corners: out of the source side, one or two
 * jogs, into the target side. `d` for an SVG path; `label` sits at the middle segment.
 */
export function routeEdge(a: { p: Point; dir: Point }, b: { p: Point; dir: Point }, routing: EdgeData["routing"]): { d: string; label: Point } {
  if (routing === "straight") {
    return { d: `M ${a.p.x} ${a.p.y} L ${b.p.x} ${b.p.y}`, label: mid(a.p, b.p) };
  }
  if (routing === "bezier") {
    const dist = Math.hypot(b.p.x - a.p.x, b.p.y - a.p.y) / 2;
    const c1 = { x: a.p.x + a.dir.x * dist, y: a.p.y + a.dir.y * dist };
    const c2 = { x: b.p.x + b.dir.x * dist, y: b.p.y + b.dir.y * dist };
    return { d: `M ${a.p.x} ${a.p.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.p.x} ${b.p.y}`, label: mid(mid(a.p, c1), mid(c2, b.p)) };
  }
  // smooth-step: leave each node perpendicular, jog at the middle of the gap.
  const p0 = a.p;
  const p3 = b.p;
  const p1 = { x: p0.x + a.dir.x * OFF, y: p0.y + a.dir.y * OFF };
  const p2 = { x: p3.x + b.dir.x * OFF, y: p3.y + b.dir.y * OFF };
  const pts: Point[] = [p0, p1];
  if (a.dir.x !== 0 && b.dir.x !== 0) {
    // horizontal out, horizontal in → vertical jog midway
    const mx = (p1.x + p2.x) / 2;
    pts.push({ x: mx, y: p1.y }, { x: mx, y: p2.y });
  } else if (a.dir.y !== 0 && b.dir.y !== 0) {
    const my = (p1.y + p2.y) / 2;
    pts.push({ x: p1.x, y: my }, { x: p2.x, y: my });
  } else if (a.dir.x !== 0) {
    // horizontal out, vertical in → single corner (or double-back jog when facing away)
    pts.push({ x: p2.x, y: p1.y });
  } else {
    pts.push({ x: p1.x, y: p2.y });
  }
  pts.push(p2, p3);
  return { d: roundedPath(dedupe(pts)), label: pts[Math.floor(pts.length / 2)]! };
}

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dedupe = (pts: Point[]): Point[] => pts.filter((p, i) => i === 0 || Math.abs(p.x - pts[i - 1]!.x) > 0.01 || Math.abs(p.y - pts[i - 1]!.y) > 0.01);

function roundedPath(pts: Point[], radius = 8): string {
  if (pts.length < 3) return `M ${pts[0]!.x} ${pts[0]!.y} L ${pts[pts.length - 1]!.x} ${pts[pts.length - 1]!.y}`;
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]!;
    const cur = pts[i]!;
    const next = pts[i + 1]!;
    const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const outLen = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const before = { x: cur.x - ((cur.x - prev.x) / inLen) * r, y: cur.y - ((cur.y - prev.y) / inLen) * r };
    const after = { x: cur.x + ((next.x - cur.x) / outLen) * r, y: cur.y + ((next.y - cur.y) / outLen) * r };
    d += ` L ${before.x} ${before.y} Q ${cur.x} ${cur.y} ${after.x} ${after.y}`;
  }
  d += ` L ${pts[pts.length - 1]!.x} ${pts[pts.length - 1]!.y}`;
  return d;
}

/** Arrowhead polygon at an end point, pointing along `dir`. */
export function arrowHead(p: Point, dir: Point, size = 9): string {
  const px = { x: -dir.y, y: dir.x };
  return `${p.x},${p.y} ${p.x - dir.x * size + px.x * size * 0.45},${p.y - dir.y * size + px.y * size * 0.45} ${p.x - dir.x * size - px.x * size * 0.45},${p.y - dir.y * size - px.y * size * 0.45}`;
}

/** Source/target anchor pair for an edge item, choosing the facing side when no handle is stored. */
export function edgeEnds(map: ItemMap, edge: Item): { a: ReturnType<typeof edgeAnchor>; b: ReturnType<typeof edgeAnchor> } | null {
  const d = edge.data as Partial<EdgeData>;
  if (!d.from || !d.to) return null;
  const from = map.get(d.from.itemId);
  const to = map.get(d.to.itemId);
  if (!from || !to) return null;
  const sideAB = facing(map, from, to);
  const a = edgeAnchor(map, from, endHandle(from, d.from.handle, sideAB), to);
  const b = edgeAnchor(map, to, endHandle(to, d.to.handle, sideAB === "l" || sideAB === "r" ? (sideAB === "l" ? "r" : "l") : sideAB === "t" ? "b" : "t"), from);
  return { a, b };
}

export const rectsIntersect = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export const normRect = (x0: number, y0: number, x1: number, y1: number): Rect => ({
  x: Math.min(x0, x1),
  y: Math.min(y0, y1),
  width: Math.abs(x1 - x0),
  height: Math.abs(y1 - y0),
});

// ---------------------------------------------------------------------------
// Freehand strokes
// ---------------------------------------------------------------------------

/** Smooth path through flattened stroke points [x,y,…] (mid-point quadratic smoothing). */
export function strokePath(flat: number[]): string {
  if (flat.length < 2) return "";
  if (flat.length < 6) return `M${flat[0]} ${flat[1]}${flat.length >= 4 ? ` L${flat[2]} ${flat[3]}` : ""}`;
  let d = `M${flat[0]} ${flat[1]}`;
  for (let i = 2; i < flat.length - 2; i += 2) {
    const xc = (flat[i]! + flat[i + 2]!) / 2;
    const yc = (flat[i + 1]! + flat[i + 3]!) / 2;
    d += ` Q${flat[i]} ${flat[i + 1]} ${xc} ${yc}`;
  }
  d += ` L${flat[flat.length - 2]} ${flat[flat.length - 1]}`;
  return d;
}

function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Closest distance from a world point to a draw item's stroke (handles resize scaling + parent offset). */
export function distToDrawStroke(map: ItemMap, item: Item, p: Point): number {
  const flat = ((item.data as { points?: number[] }).points ?? []) as number[];
  if (flat.length < 4) return Infinity;
  const r = absRect(map, item);
  const d = item.data as { nw?: number; nh?: number };
  const sx = d.nw ? item.width / d.nw : 1;
  const sy = d.nh ? item.height / d.nh : 1;
  let min = Infinity;
  for (let i = 0; i + 3 < flat.length; i += 2) {
    min = Math.min(min, distToSeg(p.x, p.y, r.x + flat[i]! * sx, r.y + flat[i + 1]! * sy, r.x + flat[i + 2]! * sx, r.y + flat[i + 3]! * sy));
  }
  return min;
}
