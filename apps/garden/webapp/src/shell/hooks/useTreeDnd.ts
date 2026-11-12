import { useState } from "react";
import type { TreeNode } from "@shared/model";
import type { Garden } from "../../lib/queries";

export type DropZone = "before" | "inside" | "after";

/** Sidebar drag-and-drop: drop on an item's middle → nest inside, edges → reorder as sibling. */
export function useTreeDnd(garden: Garden, siblingsOf: (parentId: string | null) => TreeNode[]) {
  const [dragging, setDragging] = useState<TreeNode | null>(null);
  const [target, setTarget] = useState<{ id: string; zone: DropZone } | null>(null);

  const zoneFor = (e: React.DragEvent, node: TreeNode): DropZone => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    if (y < 0.28) return "before";
    if (y > 0.72) return "after";
    return node.kind === "database" && dragging?.kind === "database" ? "after" : "inside";
  };

  const drop = async (node: TreeNode, zone: DropZone) => {
    const src = dragging;
    setDragging(null);
    setTarget(null);
    if (!src || src.id === node.id) return;
    if (zone === "inside") return garden.patchRecord(src.id, { parentId: node.id });
    const sibs = siblingsOf(node.parentId).filter((s) => s.id !== src.id);
    const i = sibs.findIndex((s) => s.id === node.id);
    const neighbor = zone === "before" ? sibs[i - 1] : sibs[i + 1];
    const position = neighbor ? (node.position + neighbor.position) / 2 : zone === "before" ? node.position - 1 : node.position + 1;
    return garden.patchRecord(src.id, { parentId: node.parentId, position });
  };

  return {
    dragging,
    target,
    bind: (node: TreeNode) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        setDragging(node);
      },
      onDragEnd: () => (setDragging(null), setTarget(null)),
      onDragOver: (e: React.DragEvent) => {
        if (!dragging || dragging.id === node.id) return;
        e.preventDefault();
        e.stopPropagation();
        const zone = zoneFor(e, node);
        if (target?.id !== node.id || target.zone !== zone) setTarget({ id: node.id, zone });
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        void drop(node, zoneFor(e, node));
      },
    }),
  };
}
