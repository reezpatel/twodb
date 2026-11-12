import { useMemo, useState } from "react";
import { adjustItem, moveItemsTo, refreshAll } from "../../lib/actions";
import { api, type ItemQuery } from "../../lib/api";
import { navigate, useRoute } from "../../lib/router";
import { useQuery } from "../../lib/query";
import type { Item, Place } from "../../lib/types";

export type ViewMode = "grid" | "list";

/** Holding hook for <ItemsPage>: URL-driven filters, view mode, selection + bulk actions. */
export function useItemsPage() {
  const { query } = useRoute();
  const filters: ItemQuery = {
    q: query.get("q") ?? undefined,
    category: query.get("category") ?? undefined,
    locationId: query.get("locationId") ?? undefined,
    tag: query.get("tag") ?? undefined,
    low: query.get("low") === "1",
    unplaced: query.get("unplaced") === "1",
    favorite: query.get("favorite") === "1",
    sort: (query.get("sort") as ItemQuery["sort"]) ?? undefined,
  };
  const key = `items?${query.toString()}`;
  const { data, loading, refreshing } = useQuery(key, () => api.items(filters));
  const places = useQuery("places", api.places);
  const filterPlace = filters.locationId ? places.data?.locations.find((p) => p.id === filters.locationId) : undefined;

  const [view, setViewState] = useState<ViewMode>(() => (localStorage.getItem("twothing.view") as ViewMode) || "grid");
  const setView = (v: ViewMode) => {
    localStorage.setItem("twothing.view", v);
    setViewState(v);
  };

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);

  const setFilter = (k: string, v: string | null) => {
    const p = new URLSearchParams(query);
    if (v === null || v === "") p.delete(k);
    else p.set(k, v);
    navigate(`/items?${p}`, { replace: true });
  };
  const toggle = (k: "low" | "unplaced" | "favorite") => setFilter(k, query.get(k) === "1" ? null : "1");

  const items = data?.items ?? [];
  const selectedItems = useMemo(() => items.filter((i) => selected.has(i.id)), [items, selected]);
  const activeFilters = ["category", "locationId", "tag", "low", "unplaced", "favorite", "q"].filter((k) => query.get(k)).length;

  return {
    filters,
    filterPlace,
    items,
    loading,
    refreshing,
    view,
    setView,
    setFilter,
    toggle,
    activeFilters,
    clearFilters: () => navigate("/items", { replace: true }),
    open: (it: Item) => navigate(`/items/${it.id}`),
    onDelta: (it: Item, d: number) => void adjustItem(it, d),
    toggleFavorite: (it: Item) => void api.updateItem(it.id, { favorite: !it.favorite }).then(refreshAll),
    selecting,
    setSelecting: (on: boolean) => {
      setSelecting(on);
      if (!on) setSelected(new Set());
    },
    selected,
    toggleSelect: (id: string) =>
      setSelected((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    selectAll: () => setSelected(new Set(items.map((i) => i.id))),
    moveOpen,
    setMoveOpen,
    moveSelected: async (p: Place | null) => {
      setMoveOpen(false);
      if (await moveItemsTo(selectedItems, p)) {
        setSelected(new Set());
        setSelecting(false);
      }
    },
    printSelected: () => navigate(`/labels/print?items=${[...selected].join(",")}`),
  };
}
