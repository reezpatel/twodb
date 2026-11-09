import { useMemo, useState } from "react";
import { SHOWCASE_GROUPS, SHOWCASE_ITEMS } from "./showcase-items";

/** Showcase gallery state — search, group filter, active mock. */
export function useShowcaseScene() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SHOWCASE_ITEMS.filter((item) => {
      if (group && item.group !== group) return false;
      if (q && !item.title.toLowerCase().includes(q) && !item.id.includes(q)) return false;
      return true;
    });
  }, [query, group]);

  const active = activeId ? (SHOWCASE_ITEMS.find((i) => i.id === activeId) ?? null) : null;

  return { query, setQuery, group, setGroup, activeId, setActiveId, items, active, groups: SHOWCASE_GROUPS };
}
