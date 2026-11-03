import type { AppNavFileMove, AppNavFileNode } from "./app-nav-file-tree";

export const PAGES: AppNavFileNode[] = [
  {
    id: "p-docs",
    name: "docs",
    defaultOpen: true,
    children: [
      { id: "p-getting-started", name: "getting-started.md" },
      { id: "p-architecture", name: "architecture.md", badge: "new" },
      {
        id: "p-api",
        name: "api",
        children: [
          { id: "p-api-auth", name: "auth.md" },
          { id: "p-api-memories", name: "memories.md" },
        ],
      },
    ],
  },
  { id: "p-roadmap", name: "roadmap.md" },
  { id: "p-ideas", name: "ideas.md" },
];

export const PROJECTS: AppNavFileNode[] = [
  {
    id: "j-twodb",
    name: "twodb",
    defaultOpen: true,
    children: [
      {
        id: "j-server",
        name: "server",
        children: [
          { id: "j-routes", name: "routes", children: [] },
          { id: "j-lib", name: "lib", children: [] },
        ],
      },
      { id: "j-desktop", name: "desktop", children: [] },
      { id: "j-readme", name: "README.md" },
    ],
  },
  { id: "j-scratch", name: "scratch.ts" },
];

/** A deep, wide tree: `folders` folders of `perFolder` files. For testing virtualized scrolling. */
export function largeTree(folders = 60, perFolder = 25): AppNavFileNode[] {
  return Array.from({ length: folders }, (_, f) => ({
    id: `l-${f}`,
    name: `folder-${String(f + 1).padStart(2, "0")}`,
    defaultOpen: f < 2,
    children: Array.from({ length: perFolder }, (_, i) => ({ id: `l-${f}-${i}`, name: `file-${String(i + 1).padStart(2, "0")}.ts` })),
  }));
}

function mapNodes(nodes: AppNavFileNode[], fn: (node: AppNavFileNode) => AppNavFileNode | null): AppNavFileNode[] {
  return nodes.flatMap((node) => {
    const next = fn(node);
    if (!next) return [];
    return [next.children ? { ...next, children: mapNodes(next.children, fn) } : next];
  });
}

function findNode(nodes: AppNavFileNode[], id: string): AppNavFileNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = node.children && findNode(node.children, id);
    if (hit) return hit;
  }
  return undefined;
}

export const renameNode = (nodes: AppNavFileNode[], id: string, name: string) => mapNodes(nodes, (n) => (n.id === id ? { ...n, name } : n));

export const deleteNode = (nodes: AppNavFileNode[], id: string) => mapNodes(nodes, (n) => (n.id === id ? null : n));

/** Adds a new file under `parentId` (or at the root when null). */
export function addNode(nodes: AppNavFileNode[], parentId: string | null, name = "untitled.md"): AppNavFileNode[] {
  const fresh: AppNavFileNode = { id: `new-${Date.now()}`, name };
  if (parentId === null) return [...nodes, fresh];
  return mapNodes(nodes, (n) => (n.id === parentId ? { ...n, children: [...(n.children ?? []), fresh] } : n));
}

/** Applies a drag-and-drop move: lifts the dragged nodes out and inserts them at `index` under the new parent. */
export function moveNodes(nodes: AppNavFileNode[], { ids, parentId, index }: AppNavFileMove): AppNavFileNode[] {
  const moved = ids.map((id) => findNode(nodes, id)).filter((n): n is AppNavFileNode => !!n);
  const without = mapNodes(nodes, (n) => (ids.includes(n.id) ? null : n));
  if (parentId === null) return [...without.slice(0, index), ...moved, ...without.slice(index)];
  return mapNodes(without, (n) =>
    n.id === parentId ? { ...n, children: [...(n.children ?? []).slice(0, index), ...moved, ...(n.children ?? []).slice(index)] } : n,
  );
}
