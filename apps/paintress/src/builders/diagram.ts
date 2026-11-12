import type { Item } from "../shared/model.js";
import type { DiagramRequest } from "../shared/dto.js";
import { findShape, getGroupStyle, GROUP_STYLE_BY_ID, type ShapeDef } from "../shared/shapes.js";
import { resolveIcon } from "../icons.js";
import { layoutGraph, type LEdge, type LNode } from "../layout.js";
import { reconcile, type Desired, type Plan } from "./reconcile.js";

/** Width grows with the label so text fits; tiny glyph shapes keep their size. */
export function fitSize(shape: ShapeDef, label: string, sublabel?: string): { width: number; height: number } {
  if (shape.labelBelow || shape.w <= 60) return { width: shape.w, height: shape.h };
  const chars = Math.max(label.length, (sublabel ?? "").length * 0.9);
  const width = Math.max(shape.w, Math.min(300, Math.round(chars * 7.4 + 44)));
  return { width, height: sublabel ? Math.max(shape.h, 84) : shape.h };
}

export async function buildDiagram(req: DiagramRequest, existing: Item[]): Promise<Plan> {
  const warnings: string[] = [];
  const desired: Desired[] = [];
  const lnodes: LNode[] = [];
  const ledges: LEdge[] = [];
  const keys = new Set<string>();
  const claim = (k: string) => {
    if (keys.has(k)) throw new Error(`duplicate key "${k}"`);
    keys.add(k);
  };

  for (const g of req.groups) {
    claim(g.key);
    let styleId = g.style ?? "plain";
    if (!GROUP_STYLE_BY_ID[styleId]) {
      warnings.push(`group ${g.key}: unknown style "${styleId}", using "plain"`);
      styleId = "plain";
    }
    const style = getGroupStyle(styleId);
    const icon = g.icon ? resolveIcon(g.icon) : style.icon;
    if (g.icon && !icon) warnings.push(`group ${g.key}: icon "${g.icon}" not found`);
    desired.push({
      key: g.key,
      type: "group",
      parentKey: g.parent ?? null,
      data: { pack: style.pack, kind: style.id, title: g.title || style.label, ...(icon ? { icon } : {}) },
    });
    lnodes.push({ id: g.key, width: 0, height: 0, parent: g.parent ?? null, isGroup: true });
  }

  for (const n of req.nodes) {
    claim(n.key);
    const icon = n.icon ? resolveIcon(n.icon) : undefined;
    if (n.icon && !icon) warnings.push(`node ${n.key}: icon "${n.icon}" not found (try GET /icons/search)`);
    let shape = findShape(n.shape ?? (icon ? "icon-card" : "rounded"), n.pack);
    if (!shape) {
      warnings.push(`node ${n.key}: unknown shape "${n.shape}", using "rounded"`);
      shape = findShape("rounded")!;
    }
    const size = fitSize(shape, n.label, n.sublabel);
    desired.push({
      key: n.key,
      type: "shape",
      parentKey: n.parent ?? null,
      data: {
        pack: shape.pack,
        shape: shape.id,
        text: n.label,
        ...(n.sublabel ? { sublabel: n.sublabel } : {}),
        ...(icon ? { icon } : {}),
        ...(n.fill ? { fill: n.fill } : {}),
        ...(n.stroke ? { stroke: n.stroke } : {}),
      },
      box: { x: 0, y: 0, ...size },
    });
    lnodes.push({ id: n.key, ...size, height: size.height + (shape.labelBelow ? 28 : 0), parent: n.parent ?? null });
  }

  const seen = new Map<string, number>();
  for (const e of req.edges) {
    const base = e.key ?? `${e.from}->${e.to}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const key = n ? `${base}#${n + 1}` : base;
    claim(key);
    const kind = e.kind ?? "flow";
    desired.push({
      key,
      type: "edge",
      data: {
        from: { itemId: e.from },
        to: { itemId: e.to },
        ...(e.label ? { label: e.label } : {}),
        ...(e.step !== undefined ? { step: e.step } : {}),
        kind,
        routing: e.routing ?? "orthogonal",
        startCap: e.bidirectional ? "arrow" : "none",
        endCap: "arrow",
        ...(e.dashed ?? kind === "async" ? { dashed: true } : {}),
      },
    });
    ledges.push({ id: key, from: e.from, to: e.to });
  }

  // Lay out the whole requested diagram; reconcile() keeps hand-placed items.
  const placed = await layoutGraph(lnodes, ledges, req.direction);
  for (const d of desired) {
    const p = placed.get(d.key);
    if (p) d.box = p;
  }
  const plan = reconcile(existing, desired, { mode: req.mode, relayout: req.relayout, origin: req.origin });
  plan.warnings.unshift(...warnings);
  return plan;
}
