import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { TreeNode } from "@shared/model";
import { getSpace, setSpace } from "../../lib/api";
import { useGarden, useSpaces, useTree } from "../../lib/queries";
import { useTreeDnd } from "./useTreeDnd";

const EXPANDED_KEY = "garden.expanded";

/** Holding hook for the sidebar: tree, expansion state, drag-and-drop, spaces, new doc. */
export function useSidebar() {
  const tree = useTree();
  const garden = useGarden();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const spaces = useSpaces().data?.spaces ?? [];
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? "[]") as string[]));

  const nodes = tree.data?.nodes ?? [];
  const byParent = useMemo(() => {
    const m = new Map<string | null, TreeNode[]>();
    for (const n of nodes) m.set(n.parentId, [...(m.get(n.parentId) ?? []), n]);
    return m;
  }, [nodes]);
  const childrenOf = useCallback((id: string | null) => byParent.get(id) ?? [], [byParent]);
  const dnd = useTreeDnd(garden, childrenOf);

  const toggle = useCallback((id: string, open?: boolean) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (open ?? !n.has(id)) n.add(id);
      else n.delete(id);
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...n]));
      return n;
    });
  }, []);

  const current = getSpace() ?? spaces[0]?.id ?? null;
  return {
    loading: tree.isLoading,
    error: tree.error,
    roots: childrenOf(null),
    favorites: tree.data?.favorites ?? [],
    defaultDatabaseId: tree.data?.defaultDatabaseId,
    ctx: { childrenOf, garden, dnd, expanded, toggle },
    rootDrop: {
      onDragOver: (e: React.DragEvent) => dnd.dragging && e.preventDefault(),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        if (dnd.dragging) void garden.patchRecord(dnd.dragging.id, { parentId: null });
      },
    },
    spaces,
    currentSpace: spaces.find((s) => s.id === current) ?? null,
    switchSpace: (id: string) => {
      setSpace(id);
      qc.clear();
      navigate("/all");
    },
    async newDoc(parentId: string | null = null) {
      const p = await garden.createPage({ parentId });
      navigate(`/${p.id}`);
    },
    async newDatabase() {
      const d = await garden.createDatabase({});
      navigate(`/${d.database.id}`);
    },
  };
}
