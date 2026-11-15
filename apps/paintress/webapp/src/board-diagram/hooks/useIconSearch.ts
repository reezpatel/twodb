import { useEffect, useState } from "react";
import { paintressClient, type IconHit } from "../../lib/paintress-client";

/** Business hook: debounced icon search for the stickers flyout. */
export function useIconSearch(active: boolean) {
  const [query, setQuery] = useState("");
  const [set, setSet] = useState<string | undefined>(undefined);
  const [icons, setIcons] = useState<IconHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!active) return;
    const q = query.trim();
    if (!q) return void setIcons([]);
    setSearching(true);
    const t = setTimeout(() => {
      paintressClient
        .searchIcons(q, set)
        .then((r) => setIcons(r.icons))
        .catch(() => setIcons([]))
        .finally(() => setSearching(false));
    }, 220);
    return () => clearTimeout(t);
  }, [active, query, set]);

  return { query, setQuery, set, setSet, icons, searching };
}
