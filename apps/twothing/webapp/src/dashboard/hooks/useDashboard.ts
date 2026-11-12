import { adjustItem } from "../../lib/actions";
import { api } from "../../lib/api";
import { useQuery } from "../../lib/query";
import type { Item } from "../../lib/types";
import { useScanner } from "../../scanner/ScanContext";

/** Holding hook for <Dashboard>. */
export function useDashboard() {
  const { data, loading } = useQuery("stats", api.stats);
  const scanner = useScanner();
  const hour = new Date().getHours();
  return {
    stats: data,
    loading,
    fresh: !!data && data.totals.items === 0 && data.totals.locations === 0,
    greeting: hour < 5 ? "Late night tinkering" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening",
    scan: () => scanner.open(),
    putAway: () => scanner.open({ mode: "putaway" }),
    stockOut: () => scanner.open({ mode: "stockOut" }),
    onDelta: (it: Item, d: number) => void adjustItem(it, d),
  };
}
