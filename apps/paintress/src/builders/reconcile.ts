// Turns a *desired* set of keyed items into create/update/delete ops against
// what's already on the board. Shared by /diagram, /erd, /process and /mermaid.
import { ulid } from "ulid";
import type { Item, ItemType, Op } from "../shared/model.js";
import type { Placed } from "../layout.js";

export interface Desired {
  key: string;
  type: ItemType;
  parentKey?: string | null;
  data: Record<string, unknown>;
  /** Layout box, relative to the parent (absolute at root). */
  box?: Placed;
}

export interface Plan {
  ops: Op[];
  keyToId: Record<string, string>;
  created: number;
  updated: number;
  deleted: number;
  warnings: string[];
}

export interface ReconcileOptions {
  mode: "merge" | "replace";
  /** Move items a human positioned by hand too. */
  relayout?: boolean;
  origin?: { x: number; y: number };
}

/** Absolute bounding box of everything currently on the board (for default placement). */
export function boardBounds(items: Item[]): { x: number; y: number; w: number; h: number } | null {
  const byId = new Map(items.map((i) => [i.id, i]));
  const abs = (i: Item): { x: number; y: number } => {
    let x = i.x;
    let y = i.y;
    let p = i.parentId ? byId.get(i.parentId) : undefined;
    while (p) {
      x += p.x;
      y += p.y;
      p = p.parentId ? byId.get(p.parentId) : undefined;
    }
    return { x, y };
  };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const i of items) {
    if (i.type === "edge") continue;
    const a = abs(i);
    minX = Math.min(minX, a.x);
    minY = Math.min(minY, a.y);
    maxX = Math.max(maxX, a.x + i.width);
    maxY = Math.max(maxY, a.y + i.height);
  }
  return Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}

export function reconcile(existing: Item[], desired: Desired[], opts: ReconcileOptions): Plan {
  const warnings: string[] = [];
  const ops: Op[] = [];
  const keyToId: Record<string, string> = {};
  let created = 0;
  let updated = 0;
  let deleted = 0;

  if (opts.mode === "replace") {
    for (const i of existing) {
      if (!i.parentId && i.type !== "edge") {
        ops.push({ op: "delete", id: i.id });
        deleted++;
      }
    }
  }
  const byKey = new Map<string, Item>();
  if (opts.mode === "merge") for (const i of existing) if (i.key) byKey.set(i.key, i);

  // Where do brand-new diagrams go? Origin, else beside whatever is already there.
  let origin = opts.origin;
  if (!origin) {
    const anyExisting = desired.some((d) => byKey.has(d.key));
    const b = opts.mode === "merge" && !anyExisting ? boardBounds(existing) : null;
    origin = b ? { x: b.x + b.w + 120, y: b.y } : { x: 0, y: 0 };
  }

  // Parents must be created before children; edges last.
  const rank = (d: Desired) => (d.type === "edge" ? 2 : 0);
  const ordered = topo(desired).sort((a, b) => rank(a) - rank(b));
  // topo() is stable w.r.t. parents; the sort above is stable too, so parent order survives.

  const desiredKeys = new Set(desired.map((d) => d.key));
  for (const d of ordered) {
    const parentId = d.parentKey ? keyToId[d.parentKey] ?? byKey.get(d.parentKey)?.id : undefined;
    if (d.parentKey && !parentId) warnings.push(`${d.key}: parent "${d.parentKey}" not found, placed at top level`);
    const parentIsDesired = !!d.parentKey && desiredKeys.has(d.parentKey);
    const prev = byKey.get(d.key);
    const data = resolveEdgeEnds(d, keyToId, byKey, warnings);
    if (!data) continue; // edge with unknown endpoints
    const root = !parentId;
    const box = d.box
      ? { ...d.box, x: d.box.x + (root && !parentIsDesired ? origin.x : 0), y: d.box.y + (root && !parentIsDesired ? origin.y : 0) }
      : undefined;
    if (prev) {
      keyToId[d.key] = prev.id;
      const patch: Record<string, unknown> = { data, parentId: parentId ?? null };
      if (box && (!prev.pinned || opts.relayout)) {
        patch.x = box.x;
        patch.y = box.y;
        patch.width = box.width;
        patch.height = box.height;
      }
      ops.push({ op: "update", id: prev.id, patch });
      updated++;
    } else {
      const id = ulid();
      keyToId[d.key] = id;
      ops.push({
        op: "create",
        item: {
          id,
          key: d.key,
          type: d.type,
          parentId: parentId ?? null,
          x: box?.x ?? 0,
          y: box?.y ?? 0,
          ...(box && box.width ? { width: box.width, height: box.height } : {}),
          data,
        },
      });
      created++;
    }
  }
  return { ops, keyToId, created, updated, deleted, warnings };
}

function resolveEdgeEnds(
  d: Desired,
  keyToId: Record<string, string>,
  byKey: Map<string, Item>,
  warnings: string[],
): Record<string, unknown> | null {
  if (d.type !== "edge") return d.data;
  const from = d.data.from as { itemId: string; handle?: string };
  const to = d.data.to as { itemId: string; handle?: string };
  // Edge endpoints are written as keys by the builders; swap them for ids here.
  const f = keyToId[from.itemId] ?? byKey.get(from.itemId)?.id;
  const t = keyToId[to.itemId] ?? byKey.get(to.itemId)?.id;
  if (!f || !t) {
    warnings.push(`edge ${d.key}: unknown endpoint ${!f ? from.itemId : to.itemId}, skipped`);
    return null;
  }
  return { ...d.data, from: { ...from, itemId: f }, to: { ...to, itemId: t } };
}

function topo(list: Desired[]): Desired[] {
  const byKey = new Map(list.map((d) => [d.key, d]));
  const out: Desired[] = [];
  const seen = new Set<string>();
  const visit = (d: Desired) => {
    if (seen.has(d.key)) return;
    seen.add(d.key);
    const p = d.parentKey ? byKey.get(d.parentKey) : undefined;
    if (p) visit(p);
    out.push(d);
  };
  list.forEach(visit);
  return out;
}
