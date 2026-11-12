import { api, errorMessage } from "./api";
import { formatQty, pathText } from "./format";
import { invalidate } from "./query";
import { toast } from "./toast";
import type { Item, Place } from "./types";

/** Everything that changes stock/location goes through here: one place for invalidation + undo. */
export const refreshAll = () => invalidate("items", "item:", "stats", "places", "place:", "activity", "batches", "batch:", "tags");

export async function adjustItem(item: Pick<Item, "id" | "name" | "unit">, delta: number, opts: { quiet?: boolean } = {}) {
  try {
    const next = await api.adjust(item.id, { delta });
    refreshAll();
    if (!opts.quiet)
      toast(`${item.name}: ${delta > 0 ? "+" : ""}${formatQty(delta)} → ${formatQty(next.quantity)} ${next.unit}`, {
        tone: "success",
        action: { label: "Undo", run: () => void api.adjust(item.id, { delta: -delta }).then(refreshAll) },
      });
    return next;
  } catch (e) {
    toast(errorMessage(e), { tone: "error" });
    return null;
  }
}

export async function moveItemsTo(items: Pick<Item, "id" | "name" | "locationId">[], place: Pick<Place, "id" | "name"> | null, opts: { quiet?: boolean } = {}) {
  const prev = items.map((i) => ({ id: i.id, from: i.locationId }));
  try {
    await api.moveItems(
      items.map((i) => i.id),
      place?.id ?? null,
    );
    refreshAll();
    if (!opts.quiet)
      toast(`${items.length === 1 ? items[0].name : `${items.length} items`} → ${place ? place.name : "Unplaced"}`, {
        tone: "success",
        action: {
          label: "Undo",
          run: async () => {
            const groups = new Map<string | null, string[]>();
            for (const p of prev) groups.set(p.from, [...(groups.get(p.from) ?? []), p.id]);
            for (const [loc, ids] of groups) await api.moveItems(ids, loc);
            refreshAll();
          },
        },
      });
    return true;
  } catch (e) {
    toast(errorMessage(e), { tone: "error" });
    return false;
  }
}

export const placeLabel = (p: Pick<Place, "path">) => pathText(p.path);
