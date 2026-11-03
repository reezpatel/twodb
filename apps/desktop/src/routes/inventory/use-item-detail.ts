import { useMemo, useState } from "react";
import { inventoryErrorMessage, type Crumb, type InventoryItem } from "./inventory-api";
import { useInventoryContext } from "./inventory-provider";
import { useInventoryLog } from "./use-inventory";

export type AdjustMode = "add" | "remove" | "set";

export function useItemDetail(item: InventoryItem | null) {
  const inv = useInventoryContext();
  const locations = inv.locations.data?.locations ?? [];
  const [mode, setMode] = useState<AdjustMode>("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const log = useInventoryLog(inv.id, item?.id ?? null, !!item);

  const breadcrumb = useMemo<Crumb[]>(() => {
    const byId = new Map(locations.map((l) => [l.id, l]));
    const chain: Crumb[] = [];
    for (let cur = item?.locationId ? byId.get(item.locationId) : undefined; cur && chain.length < 32; cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
      chain.unshift({ id: cur.id, title: cur.title, code: cur.code, kind: cur.kind });
    }
    return chain;
  }, [locations, item?.locationId]);

  const applyAdjust = () => {
    if (!item) return;
    const n = Number(amount);
    if (!amount.trim() || !Number.isFinite(n) || n < 0 || (mode !== "set" && n === 0)) {
      setError("Enter a valid amount");
      return;
    }
    setError(null);
    const op = mode === "set" ? { set: n } : { delta: mode === "add" ? n : -n };
    inv.adjust.mutate(
      { itemId: item.id, ...op, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          setAmount("");
          setReason("");
        },
        onError: (e) => setError(inventoryErrorMessage(e)),
      },
    );
  };

  const applyMove = () => {
    if (!item || moveTo === null) return;
    setError(null);
    inv.move.mutate(
      { itemId: item.id, locationId: moveTo || null },
      { onSuccess: () => setMoveTo(null), onError: (e) => setError(inventoryErrorMessage(e)) },
    );
  };

  const goToLocation = (locationId: string) => {
    inv.setFilter({ kind: "location", locationId });
    inv.setTab("items");
    inv.setOpenItemId(null);
  };

  return {
    inv,
    locations,
    mode,
    setMode,
    amount,
    setAmount,
    reason,
    setReason,
    moveTo,
    setMoveTo,
    error,
    log,
    breadcrumb,
    applyAdjust,
    applyMove,
    goToLocation,
    adjusting: inv.adjust.isPending,
    moving: inv.move.isPending,
  };
}
