import { cn } from "@twodb/blocks";
import { api } from "../lib/api";
import { categoryOf } from "../lib/catalog";

/** Photo when there is one, otherwise the category glyph on its tint. */
export function ItemThumb({ imageId, category, className, iconClassName }: { imageId?: string | null; category: string; className?: string; iconClassName?: string }) {
  const cat = categoryOf(category);
  const Icon = cat.icon;
  if (imageId) {
    return <img src={api.imageUrl(imageId)} alt="" loading="lazy" className={cn("size-12 shrink-0 rounded-[10px] border border-outline bg-stone object-cover", className)} />;
  }
  return (
    <div
      className={cn("grid size-12 shrink-0 place-items-center rounded-[10px] border", className)}
      style={{ background: `color-mix(in oklab, ${cat.color} 14%, transparent)`, borderColor: `color-mix(in oklab, ${cat.color} 28%, transparent)`, color: cat.color }}
    >
      <Icon className={cn("size-5", iconClassName)} />
    </div>
  );
}
