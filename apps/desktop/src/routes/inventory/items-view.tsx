import { AlertTriangle, ImageOff, Minus, Package, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { mediaUrl } from "@/components/ui/property-cell/media-cell";
import { cn } from "@/lib/utils";
import { formatQuantity, inventoryErrorMessage, type InventoryItem } from "./inventory-api";
import { useInventoryContext } from "./inventory-provider";

function Thumb({ item, className }: { item: InventoryItem; className?: string }) {
  const cover = item.images[0];
  return (
    <div className={cn("bg-muted flex shrink-0 items-center justify-center overflow-hidden rounded-md", className)}>
      {cover ? <img src={mediaUrl(cover)} alt="" loading="lazy" className="size-full object-cover" /> : <ImageOff size={18} className="text-muted-foreground/50" />}
    </div>
  );
}

export { Thumb as ItemThumb };

function ItemCard({ item }: { item: InventoryItem }) {
  const inv = useInventoryContext();
  const step = (delta: number) => inv.adjust.mutate({ itemId: item.id, delta });
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inv.setOpenItemId(item.id)}
      onKeyDown={(e) => e.key === "Enter" && inv.setOpenItemId(item.id)}
      className="bg-card hover:border-ring/60 flex cursor-pointer gap-3 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-2"
    >
      <Thumb item={item} className="size-20" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-medium">{item.title || "Untitled"}</span>
          <Badge variant={item.lowStock ? "destructive" : "secondary"} className="shrink-0 tabular-nums">
            {item.lowStock ? <AlertTriangle /> : null}
            {formatQuantity(item)}
          </Badge>
        </div>
        <span className="text-muted-foreground truncate font-mono text-[11px]">{item.code ? `${item.code.slice(0, 4)}-${item.code.slice(4)}` : ""}</span>
        <span className="text-muted-foreground truncate text-xs">{item.locationPath ?? "No location"}</span>
        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex min-w-0 gap-1 overflow-hidden">
            {item.groups.slice(0, 3).map((g) => (
              <Badge key={g} variant="outline" className="text-[10px]">
                {g}
              </Badge>
            ))}
          </div>
          <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="icon-xs" variant="outline" aria-label="Remove one" disabled={item.quantity <= 0 || inv.adjust.isPending} onClick={() => step(-1)}>
              <Minus />
            </Button>
            <Button size="icon-xs" variant="outline" aria-label="Add one" disabled={inv.adjust.isPending} onClick={() => step(1)}>
              <Plus />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ItemsView() {
  const inv = useInventoryContext();
  const items = inv.items.data?.items ?? [];

  if (inv.items.isPending) {
    return (
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 py-20 text-sm">
        <Package size={28} className="text-muted-foreground/50" />
        {inv.query || inv.filter.kind !== "all" ? "No items match." : "No items yet — add your first one."}
        {!inv.query && inv.filter.kind === "all" && (inv.locations.data?.locations.length ?? 0) === 0 ? (
          <Button size="sm" variant="outline" onClick={() => inv.setLocationForm({ location: null })}>
            <Plus /> Add a warehouse or rack first
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <>
      {inv.adjust.isError ? <p className="text-destructive mb-2 text-xs">{inventoryErrorMessage(inv.adjust.error)}</p> : null}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </>
  );
}
