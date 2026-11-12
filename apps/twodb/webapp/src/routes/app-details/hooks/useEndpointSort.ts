import { useCallback, useMemo, useState } from "react";
import type { EndpointSpec } from "../../../lib/gateway-client.js";

type SortKey = "method" | "path" | "auth";
type SortDir = "asc" | "desc";

/**
 * Sort state for the endpoint table (ported from the cnippet demo's
 * toggleSort): clicking a new column sorts desc-first; clicking the active
 * column toggles direction.
 */
export function useEndpointSort(endpoints: EndpointSpec[]) {
  const [sortKey, setSortKey] = useState<SortKey>("path");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir("desc");
      return key;
    });
  }, []);

  const sorted = useMemo(() => {
    const val = sortDir === "asc" ? 1 : -1;
    return [...endpoints].sort((a, b) => val * String(a[sortKey]).localeCompare(String(b[sortKey])));
  }, [endpoints, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggleSort };
}
