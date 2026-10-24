import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotesHook, TreeNode } from "../use-notes-scene";
import { NodeIcon } from "./section-tree";

/** Flat sidebar row (favorites, dangling databases) — click opens the node. */
export function FlatNodeRow({ node, notes, showStar = false }: { node: TreeNode; notes: NotesHook; showStar?: boolean }) {
  return (
    <div
      className={cn(
        "group flex h-[26px] cursor-pointer items-center gap-1.5 px-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground",
        notes.selectedId === node.id && "bg-accent font-medium text-foreground",
      )}
      onClick={() => notes.select(node.id)}
    >
      <NodeIcon kind={node.kind} icon={node.icon} />
      <span className="min-w-0 flex-1 truncate">{node.title || "Untitled"}</span>
      {showStar && (
        <button
          className="text-warning shrink-0 text-xs leading-none"
          title="Remove from favorites"
          onClick={(e) => {
            e.stopPropagation();
            notes.toggleFavorite.mutate({ id: node.id, isFavorite: false });
          }}
        >
          <Star size={12} fill="currentColor" />
        </button>
      )}
    </div>
  );
}
