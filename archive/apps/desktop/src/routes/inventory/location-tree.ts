import type { InventoryLocation } from "./inventory-api";

export interface LocationNode extends InventoryLocation {
  children: LocationNode[];
  depth: number;
}

export function buildLocationTree(locations: InventoryLocation[]): LocationNode[] {
  const nodes = new Map<string, LocationNode>(locations.map((l) => [l.id, { ...l, children: [], depth: 0 }]));
  const roots: LocationNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const byTitle = (a: LocationNode, b: LocationNode) => a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
  const finish = (list: LocationNode[], depth: number) => {
    list.sort(byTitle);
    for (const n of list) {
      n.depth = depth;
      finish(n.children, depth + 1);
    }
  };
  finish(roots, 0);
  return roots;
}

export function flattenTree(roots: LocationNode[], collapsed?: Set<string>): LocationNode[] {
  const out: LocationNode[] = [];
  const walk = (list: LocationNode[]) => {
    for (const n of list) {
      out.push(n);
      if (!collapsed?.has(n.id)) walk(n.children);
    }
  };
  walk(roots);
  return out;
}

/** Ids of a location and everything beneath it. */
export function descendantIds(roots: LocationNode[], id: string): Set<string> {
  const out = new Set<string>();
  const collect = (n: LocationNode) => {
    out.add(n.id);
    n.children.forEach(collect);
  };
  const find = (list: LocationNode[]): LocationNode | undefined => {
    for (const n of list) {
      if (n.id === id) return n;
      const hit = find(n.children);
      if (hit) return hit;
    }
  };
  const root = find(roots);
  if (root) collect(root);
  return out;
}
