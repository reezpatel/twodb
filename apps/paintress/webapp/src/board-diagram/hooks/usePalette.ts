import { useEffect, useState } from "react";
import { paintressClient, type IconHit } from "../../lib/paintress-client";

export type PaletteTab = "shapes" | "groups" | "icons" | "more";

/** Business hook: palette tab + debounced icon search. */
export function usePalette() {
  const [tab, setTab] = useState<PaletteTab>("shapes");
  const [pack, setPack] = useState("basic");
  const [query, setQuery] = useState("");
  const [set, setSet] = useState<string | undefined>(undefined);
  const [icons, setIcons] = useState<IconHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (tab !== "icons") return;
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
  }, [tab, query, set]);

  return { tab, setTab, pack, setPack, query, setQuery, set, setSet, icons, searching };
}
