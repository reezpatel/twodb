import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { inventoryErrorMessage, type InventoryLocation, type ResolveMatch } from "./inventory-api";
import { useInventoryContext } from "./inventory-provider";

export interface ScanResult {
  code: string;
  matches: ResolveMatch[];
  at: number;
}

/** Scan flow state: resolved codes (newest first) and an optional "current
 *  location" — scan a rack/box, then scan items to put them there. */
export function useScanSession() {
  const inv = useInventoryContext();
  const [results, setResults] = useState<ScanResult[]>([]);
  const [current, setCurrent] = useState<InventoryLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code || !inv.id) return;
      setError(null);
      try {
        const { matches } = await api<{ matches: ResolveMatch[] }>(`/api/inventory/${inv.id}/resolve?code=${encodeURIComponent(code)}`);
        setResults((prev) => [{ code, matches, at: Date.now() }, ...prev.filter((r) => r.code !== code)].slice(0, 20));
        const location = matches.find((m) => m.kind === "location");
        if (location?.kind === "location") setCurrent(location.location);
      } catch (e) {
        setError(inventoryErrorMessage(e));
      }
    },
    [inv.id],
  );

  const putAway = (itemId: string) => {
    if (!current) return;
    inv.move.mutate(
      { itemId, locationId: current.id, reason: "scan put-away" },
      {
        onSuccess: () => void resolve(results.find((r) => r.matches.some((m) => m.id === itemId))?.code ?? ""),
        onError: (e) => setError(inventoryErrorMessage(e)),
      },
    );
  };

  const adjust = (itemId: string, delta: number, code: string) =>
    inv.adjust.mutate({ itemId, delta, reason: "scan" }, { onSuccess: () => void resolve(code), onError: (e) => setError(inventoryErrorMessage(e)) });

  return { inv, results, current, setCurrent, error, resolve, putAway, adjust, clear: () => setResults([]) };
}
