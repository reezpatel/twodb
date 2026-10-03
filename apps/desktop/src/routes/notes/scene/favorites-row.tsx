import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META, type TreeNodeData, type NotesHook } from "./section-tree";

export function FavoriteRow({ group, notes, isSelected }: { group: TreeNodeData; notes: NotesHook; isSelected: boolean }) {
  const Icon = TYPE_META[group.type ?? "notes"]?.icon ?? TYPE_META.notes.icon;
  return (
    <div
      className={cn("group flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-sm hover:bg-accent", isSelected && "bg-accent font-medium")}
      onClick={() => notes.setSelectedGroupId(group.id)}
    >
      <Icon size={14} className="text-muted-foreground shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{group.name}</span>
      <button
        className="text-warning shrink-0 text-xs leading-none"
        title="Remove from favorites"
        onClick={(e) => {
          e.stopPropagation();
          notes.toggleFavorite.mutate({ id: group.id, isFavorite: false });
        }}
      >
        <Star size={12} fill="currentColor" />
      </button>
    </div>
  );
}
