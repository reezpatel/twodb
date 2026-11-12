import { cn } from "@twodb/blocks";
import { Check, Star } from "lucide-react";
import type { Item } from "../../lib/types";
import { CodeChip } from "../../ui/CodeChip";
import { ItemThumb } from "../../ui/ItemThumb";
import { PlacePath } from "../../ui/PlacePath";
import { QtyStepper } from "../../ui/QtyStepper";
import { specLine } from "./ItemCard";

export function ItemRow({ item, onOpen, onDelta, selecting, selected }: { item: Item; onOpen: () => void; onDelta: (d: number) => void; selecting?: boolean; selected?: boolean }) {
  return (
    <div onClick={onOpen} className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-stone/60", selected && "bg-stone")}>
      {selecting && <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", selected ? "border-ink bg-ink text-paper" : "border-outline")}>{selected && <Check className="size-3" />}</span>}
      <ItemThumb imageId={item.imageIds[0]} category={item.category} className="size-11" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{item.name}</span>
          {item.favorite && <Star className="size-3 shrink-0 text-amber-500" fill="currentColor" />}
          {item.low && <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 text-[10px] font-semibold text-destructive">LOW</span>}
        </div>
        <div className="truncate text-xs text-ink-muted">{specLine(item, 4) || item.description || "\u00a0"}</div>
      </div>
      <PlacePath path={item.locationPath} compact className="hidden w-56 lg:inline-flex" />
      <CodeChip code={item.codeDisplay} muted className="hidden sm:inline-flex" />
      <QtyStepper quantity={item.quantity} unit={item.unit} low={item.low} onDelta={onDelta} size="sm" />
    </div>
  );
}
