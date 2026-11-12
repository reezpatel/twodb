import type { Item } from "../shared/model.js";
import type { ProcessRequest } from "../shared/dto.js";
import { findShape } from "../shared/shapes.js";
import { layoutProcess } from "../layout.js";
import { fitSize } from "./diagram.js";
import { reconcile, type Desired, type Plan } from "./reconcile.js";

export const POOL_KEY = "pool";
export const laneKey = (k: string) => `lane:${k}`;

export async function buildProcess(req: ProcessRequest, existing: Item[]): Promise<Plan> {
  const warnings: string[] = [];
  const laneSet = new Set(req.lanes.map((l) => l.key));
  if (laneSet.size !== req.lanes.length) throw new Error("duplicate lane keys");
  const stepKeys = new Set<string>();
  for (const s of req.steps) {
    if (stepKeys.has(s.key)) throw new Error(`duplicate step key "${s.key}"`);
    stepKeys.add(s.key);
    if (!laneSet.has(s.lane)) throw new Error(`step "${s.key}" references unknown lane "${s.lane}"`);
  }

  const sized = req.steps.map((s) => {
    let shape = findShape(s.shape, s.pack);
    if (!shape) {
      warnings.push(`step ${s.key}: unknown shape "${s.shape}", using "process"`);
      shape = findShape("process")!;
    }
    return { s, shape, size: fitSize(shape, s.label) };
  });
  const lay = layoutProcess(
    req.lanes.map((l) => l.key),
    sized.map(({ s, size }) => ({ key: s.key, lane: s.lane, ...size })),
    req.flows,
  );

  const desired: Desired[] = [
    { key: POOL_KEY, type: "pool", data: { title: req.title }, box: { x: 0, y: 0, ...lay.pool } },
  ];
  for (const l of req.lanes) {
    const g = lay.lanes.get(l.key)!;
    desired.push({ key: laneKey(l.key), type: "lane", parentKey: POOL_KEY, data: { title: l.title }, box: g });
  }
  for (const { s, shape, size } of sized) {
    const p = lay.steps.get(s.key)!;
    desired.push({
      key: s.key,
      type: "shape",
      parentKey: laneKey(s.lane),
      data: { pack: shape.pack, shape: shape.id, text: s.label },
      box: { x: p.x, y: p.y, ...size },
    });
  }
  const seen = new Set<string>();
  for (const f of req.flows) {
    const key = `flow:${f.from}>${f.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    desired.push({
      key,
      type: "edge",
      data: {
        from: { itemId: f.from },
        to: { itemId: f.to },
        ...(f.label ? { label: f.label } : {}),
        kind: "flow",
        routing: "orthogonal",
        startCap: "none",
        endCap: "arrow",
      },
    });
  }
  const plan = reconcile(existing, desired, { mode: req.mode, origin: req.origin, relayout: true });
  plan.warnings.unshift(...warnings);
  return plan;
}
