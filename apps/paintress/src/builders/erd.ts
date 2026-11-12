import type { Item } from "../shared/model.js";
import type { ErdRequest } from "../shared/dto.js";
import { LAYOUT, entityHeight } from "../shared/shapes.js";
import { layoutGraph, type LEdge, type LNode } from "../layout.js";
import { reconcile, type Desired, type Plan } from "./reconcile.js";
import type { Cardinality } from "../shared/model.js";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "col";

function splitRef(ref: string): { entity: string; column: string } | null {
  const i = ref.lastIndexOf(".");
  return i > 0 ? { entity: ref.slice(0, i), column: ref.slice(i + 1) } : null;
}

export async function buildErd(req: ErdRequest, existing: Item[]): Promise<Plan> {
  const warnings: string[] = [];
  const desired: Desired[] = [];
  const lnodes: LNode[] = [];
  const ledges: LEdge[] = [];

  // Column ids first, so relations can point at them.
  const colIds = new Map<string, Map<string, string>>(); // entityKey -> column name -> id
  const colMeta = new Map<string, Map<string, { nullable?: boolean; unique?: boolean }>>();
  for (const e of req.entities) {
    const used = new Set<string>();
    const ids = new Map<string, string>();
    const meta = new Map<string, { nullable?: boolean; unique?: boolean }>();
    for (const c of e.columns) {
      let id = slug(c.name);
      while (used.has(id)) id += "_";
      used.add(id);
      ids.set(c.name, id);
      meta.set(c.name, { nullable: c.nullable, unique: c.unique || c.pk });
    }
    colIds.set(e.key, ids);
    colMeta.set(e.key, meta);
  }

  for (const e of req.entities) {
    const ids = colIds.get(e.key)!;
    const columns = e.columns.map((c) => {
      const ref = c.fk ? splitRef(c.fk) : null;
      if (c.fk && !ref) warnings.push(`${e.key}.${c.name}: fk "${c.fk}" must look like "entity.column"`);
      return {
        id: ids.get(c.name)!,
        name: c.name,
        type: c.type,
        ...(c.pk ? { pk: true } : {}),
        ...(c.nullable ? { nullable: true } : {}),
        ...(c.unique ? { unique: true } : {}),
        ...(ref ? { fk: { entity: ref.entity, column: ref.column } } : {}),
      };
    });
    const height = entityHeight(columns.length);
    desired.push({
      key: e.key,
      type: "entity",
      data: { name: e.name ?? e.key, columns, ...(e.color ? { color: e.color } : {}) },
      box: { x: 0, y: 0, width: LAYOUT.entityWidth, height },
    });
    lnodes.push({ id: e.key, width: LAYOUT.entityWidth, height });
  }

  // Relations: explicit ones, plus one per column fk.
  type Rel = { from: string; to: string; label?: string; card?: { from?: Cardinality; to?: Cardinality } };
  const rels: Rel[] = [...req.relations.map((r) => ({ from: r.from, to: r.to, label: r.label, card: r.cardinality }))];
  for (const e of req.entities)
    for (const c of e.columns) if (c.fk) rels.push({ from: `${e.key}.${c.name}`, to: c.fk });

  const seen = new Set<string>();
  for (const r of rels) {
    const a = splitRef(r.from);
    const b = splitRef(r.to);
    if (!a || !b) {
      warnings.push(`relation ${r.from} -> ${r.to}: use "entity.column" on both sides`);
      continue;
    }
    const aCol = colIds.get(a.entity)?.get(a.column);
    const bCol = colIds.get(b.entity)?.get(b.column);
    if (!colIds.has(a.entity) || !colIds.has(b.entity)) {
      warnings.push(`relation ${r.from} -> ${r.to}: unknown entity`);
      continue;
    }
    if (!aCol || !bCol) warnings.push(`relation ${r.from} -> ${r.to}: unknown column, connecting entities instead`);
    const key = `rel:${r.from}>${r.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const m = colMeta.get(a.entity)?.get(a.column) ?? {};
    const card = {
      from: r.card?.from ?? (m.unique ? ("zero_or_one" as const) : ("zero_or_many" as const)),
      to: r.card?.to ?? (m.nullable ? ("zero_or_one" as const) : ("one" as const)),
    };
    desired.push({
      key,
      type: "edge",
      data: {
        from: { itemId: a.entity, ...(aCol ? { handle: aCol } : {}) },
        to: { itemId: b.entity, ...(bCol ? { handle: bCol } : {}) },
        ...(r.label ? { label: r.label } : {}),
        kind: "relation",
        routing: "orthogonal",
        startCap: "none",
        endCap: "none",
        cardinality: card,
      },
    });
    ledges.push({ id: key, from: a.entity, to: b.entity });
  }

  const placed = await layoutGraph(lnodes, ledges, req.direction);
  for (const d of desired) {
    const p = placed.get(d.key);
    if (p) d.box = { ...p, width: LAYOUT.entityWidth, height: d.box?.height ?? p.height };
  }
  const plan = reconcile(existing, desired, { mode: req.mode, relayout: req.relayout, origin: req.origin });
  plan.warnings.unshift(...warnings);
  return plan;
}
