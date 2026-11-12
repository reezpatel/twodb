import { cn } from "@twodb/blocks";
import { Check, Star, TriangleAlert } from "lucide-react";
import { api } from "../../lib/api";
import { categoryOf } from "../../lib/catalog";
import type { Item } from "../../lib/types";
import { CodeChip } from "../../ui/CodeChip";
import { PlacePath } from "../../ui/PlacePath";
import { QtyStepper } from "../../ui/QtyStepper";

export const specLine = (it: Item, n = 3) => Object.values(it.specs).filter(Boolean).slice(0, n).join(" · ");

export function ItemCard({
  item,
  onOpen,
  onDelta,
  onFavorite,
  selecting,
  selected,
}: {
  item: Item;
  onOpen: () => void;
  onDelta: (d: number) => void;
  onFavorite: () => void;
  selecting?: boolean;
  selected?: boolean;
}) {
  const cat = categoryOf(item.category);
  const Icon = cat.icon;
  const specs = specLine(item);
  return (
    <div
      onClick={onOpen}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-[18px] border border-outline bg-card transition hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-lg",
        selected && "ring-2 ring-ink",
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden" style={{ background: `color-mix(in oklab, ${cat.color} 10%, var(--card))` }}>
        {item.imageIds[0] ? (
          <img src={api.imageUrl(item.imageIds[0])} alt="" loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="grid size-full place-items-center" style={{ color: cat.color }}>
            <Icon className="size-12 opacity-70" strokeWidth={1.5} />
          </div>
        )}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-paper/90 px-2 py-0.5 text-[11px] font-semibold backdrop-blur" style={{ color: cat.color }}>
          <Icon className="size-3" /> {cat.short}
        </span>
        {selecting ? (
          <span className={cn("absolute top-2 right-2 grid size-6 place-items-center rounded-full border-2 border-paper", selected ? "bg-ink text-paper" : "bg-paper/80")}>{selected && <Check className="size-3.5" />}</span>
        ) : (
          <button
            aria-label={item.favorite ? "Unstar" : "Star"}
            onClick={(e) => {
              e.stopPropagation();
              onFavorite();
            }}
            className={cn("absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-paper/80 backdrop-blur transition", item.favorite ? "text-amber-500" : "text-ink-muted opacity-0 group-hover:opacity-100")}
          >
            <Star className="size-3.5" fill={item.favorite ? "currentColor" : "none"} />
          </button>
        )}
        {item.low && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold text-destructive-foreground">
            <TriangleAlert className="size-3" /> Low
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="line-clamp-2 leading-snug font-semibold">{item.name}</div>
        {specs && <div className="truncate text-xs text-ink-muted">{specs}</div>}
        <PlacePath path={item.locationPath} compact />
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <CodeChip code={item.codeDisplay} muted />
          <QtyStepper quantity={item.quantity} unit={item.unit} low={item.low} onDelta={onDelta} size="sm" />
        </div>
      </div>
    </div>
  );
}
