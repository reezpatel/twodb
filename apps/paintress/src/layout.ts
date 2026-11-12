// Auto-layout. Graphs (architecture, flowchart, ERD, mermaid) go through ELK
// (layered, nested groups); swimlane process maps use a small dedicated layered
// layout because lanes are a hard constraint ELK doesn't model well.
import ELK, { type ElkNode, type ElkExtendedEdge } from "elkjs/lib/elk.bundled.js";
import { LAYOUT } from "./shared/shapes.js";

export interface LNode {
  id: string;
  width: number;
  height: number;
  parent?: string | null;
  isGroup?: boolean;
  /** Minimum size for groups (e.g. an empty VPC). */
  minWidth?: number;
  minHeight?: number;
}
export interface LEdge {
  id: string;
  from: string;
  to: string;
}
export interface Placed {
  /** Relative to the parent (absolute for root-level nodes). */
  x: number;
  y: number;
  width: number;
  height: number;
}

const DIRS = { LR: "RIGHT", RL: "LEFT", TB: "DOWN", BT: "UP" } as const;
const elk = new ELK();

export async function layoutGraph(
  nodes: LNode[],
  edges: LEdge[],
  direction: keyof typeof DIRS = "LR",
): Promise<Map<string, Placed>> {
  const ids = new Set(nodes.map((n) => n.id));
  const pad = LAYOUT.groupPadding;
  const children = new Map<string | null, LNode[]>();
  for (const n of nodes) {
    const p = n.parent && ids.has(n.parent) ? n.parent : null;
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(n);
  }
  const build = (n: LNode): ElkNode => {
    const kids = children.get(n.id) ?? [];
    if (n.isGroup || kids.length) {
      return {
        id: n.id,
        children: kids.map(build),
        layoutOptions: {
          "elk.padding": `[top=${pad.top},left=${pad.left},bottom=${pad.bottom},right=${pad.right}]`,
          "elk.nodeSize.constraints": "MINIMUM_SIZE",
          "elk.nodeSize.minimum": `(${n.minWidth ?? 220}, ${n.minHeight ?? 120})`,
        },
      };
    }
    return { id: n.id, width: n.width, height: n.height };
  };
  const root: ElkNode = {
    id: "root",
    children: (children.get(null) ?? []).map(build),
    edges: edges
      .filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to)
      .map<ElkExtendedEdge>((e) => ({ id: e.id, sources: [e.from], targets: [e.to] })),
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": DIRS[direction],
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": String(LAYOUT.nodeGap),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(LAYOUT.layerGap),
      "elk.spacing.edgeNode": "24",
      "elk.separateConnectedComponents": "true",
      "elk.spacing.componentComponent": "64",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    },
  };
  const out = await elk.layout(root);
  const placed = new Map<string, Placed>();
  const walk = (n: ElkNode) => {
    for (const c of n.children ?? []) {
      placed.set(c.id, { x: c.x ?? 0, y: c.y ?? 0, width: c.width ?? 0, height: c.height ?? 0 });
      walk(c);
    }
  };
  walk(out);
  return placed;
}

// ---------------------------------------------------------------------------
// Swimlane layout
// ---------------------------------------------------------------------------
export interface PStep {
  key: string;
  lane: string;
  width: number;
  height: number;
}

export interface ProcessLayout {
  pool: { width: number; height: number };
  lanes: Map<string, { x: number; y: number; width: number; height: number }>;
  /** Relative to the step's lane. */
  steps: Map<string, { x: number; y: number }>;
}

export function layoutProcess(laneKeys: string[], steps: PStep[], flows: { from: string; to: string }[]): ProcessLayout {
  const byKey = new Map(steps.map((s) => [s.key, s]));
  const out = new Map<string, string[]>();
  for (const f of flows) {
    if (!byKey.has(f.from) || !byKey.has(f.to) || f.from === f.to) continue;
    if (!out.has(f.from)) out.set(f.from, []);
    out.get(f.from)!.push(f.to);
  }
  // Break cycles: ignore edges that point back into the DFS stack.
  const state = new Map<string, 0 | 1 | 2>();
  const dag = new Map<string, string[]>();
  const visit = (k: string) => {
    state.set(k, 1);
    for (const t of out.get(k) ?? []) {
      if (state.get(t) === 1) continue;
      if (!dag.has(k)) dag.set(k, []);
      dag.get(k)!.push(t);
      if (!state.get(t)) visit(t);
    }
    state.set(k, 2);
  };
  const hasIncoming = new Set([...out.values()].flat());
  for (const s of steps) if (!hasIncoming.has(s.key) && !state.get(s.key)) visit(s.key);
  for (const s of steps) if (!state.get(s.key)) visit(s.key);
  const layer = new Map<string, number>(steps.map((s) => [s.key, 0]));
  // Longest-path layering over the DAG (iterate to fixpoint; graph is small).
  for (let i = 0; i < steps.length; i++) {
    let changed = false;
    for (const [from, tos] of dag)
      for (const to of tos)
        if ((layer.get(to) ?? 0) < (layer.get(from) ?? 0) + 1) {
          layer.set(to, (layer.get(from) ?? 0) + 1);
          changed = true;
        }
    if (!changed) break;
  }

  const maxW = Math.max(...steps.map((s) => s.width), 120);
  const maxH = Math.max(...steps.map((s) => s.height), 60);
  const colW = maxW + 70;
  const rowH = maxH + 32;
  const padX = 36;
  const padY = 28;
  const layers = Math.max(...[...layer.values()], 0) + 1;

  const cell = new Map<string, PStep[]>(); // `${lane}|${layer}`
  for (const s of steps) {
    const k = `${s.lane}|${layer.get(s.key)}`;
    if (!cell.has(k)) cell.set(k, []);
    cell.get(k)!.push(s);
  }
  const laneRows = new Map<string, number>();
  for (const [k, list] of cell) {
    const lane = k.split("|")[0]!;
    laneRows.set(lane, Math.max(laneRows.get(lane) ?? 1, list.length));
  }

  const laneW = layers * colW + padX * 2 - 70 + 70;
  const lanes = new Map<string, { x: number; y: number; width: number; height: number }>();
  let y = 0;
  for (const lk of laneKeys) {
    const h = Math.max(LAYOUT.laneMinH, (laneRows.get(lk) ?? 1) * rowH + padY * 2);
    lanes.set(lk, { x: LAYOUT.laneGutter, y, width: laneW, height: h });
    y += h;
  }
  const placed = new Map<string, { x: number; y: number }>();
  for (const [k, list] of cell) {
    const lane = lanes.get(k.split("|")[0]!);
    if (!lane) continue;
    const l = Number(k.split("|")[1]);
    const stackH = list.length * rowH;
    const top = (lane.height - stackH) / 2;
    list.forEach((s, i) => {
      placed.set(s.key, {
        x: padX + l * colW + (maxW - s.width) / 2,
        y: top + i * rowH + (rowH - s.height) / 2,
      });
    });
  }
  return { pool: { width: LAYOUT.laneGutter + laneW, height: y }, lanes, steps: placed };
}
