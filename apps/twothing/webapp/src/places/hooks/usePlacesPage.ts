import { useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useQuery } from "../../lib/query";
import type { Place } from "../../lib/types";
import { useScanner } from "../../scanner/ScanContext";

const KEY = "twothing.collapsed";

/** Holding hook for <PlacesPage>: tree with persisted collapse state + search. */
export function usePlacesPage() {
  const { data, loading } = useQuery("places", api.places);
  const scanner = useScanner();
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]")));

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      localStorage.setItem(KEY, JSON.stringify([...n]));
      return n;
    });

  const all = data?.locations ?? [];
  const visible: Place[] = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length) {
      return all.filter((p) => terms.every((t) => `${p.path.map((c) => c.name).join(" ")} ${p.codeDisplay ?? ""} ${p.kind} ${p.description}`.toLowerCase().includes(t)));
    }
    // Hide descendants of collapsed nodes.
    return all.filter((p) => !p.path.slice(0, -1).some((c) => collapsed.has(c.id)));
  }, [all, q, collapsed]);

  const roots = all.filter((p) => !p.parentId);
  return {
    loading,
    visible,
    searching: !!q.trim(),
    q,
    setQ,
    collapsed,
    toggle,
    expandAll: () => {
      setCollapsed(new Set());
      localStorage.setItem(KEY, "[]");
    },
    collapseAll: () => {
      const n = new Set(all.filter((p) => p.childCount > 0).map((p) => p.id));
      setCollapsed(n);
      localStorage.setItem(KEY, JSON.stringify([...n]));
    },
    total: all.length,
    roots: roots.length,
    unplacedCount: data?.unplacedCount ?? 0,
    putAway: () => scanner.open({ mode: "putaway" }),
  };
}
