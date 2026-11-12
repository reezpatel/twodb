import { useState } from "react";
import { adjustItem, refreshAll } from "../../lib/actions";
import { api, errorMessage } from "../../lib/api";
import { useQuery } from "../../lib/query";
import { navigate } from "../../lib/router";
import { toast } from "../../lib/toast";
import type { Item, Place } from "../../lib/types";
import { useScanner } from "../../scanner/ScanContext";

/** Holding hook for <PlaceDetail>. */
export function usePlaceDetail(id: string) {
  const q = useQuery(`place:${id}`, () => api.place(id));
  const scanner = useScanner();
  const [moveOpen, setMoveOpen] = useState(false);
  const place = q.data?.location;

  return {
    place,
    children: q.data?.children ?? [],
    items: q.data?.items ?? [],
    activity: q.data?.activity ?? [],
    loading: q.loading,
    notFound: !!q.error,
    putAway: () => place && scanner.open({ mode: "putaway", target: place }),
    addItem: () => navigate(`/items/new?loc=${id}`),
    addChild: () => navigate(`/places/new?parent=${id}`),
    edit: () => navigate(`/places/${id}/edit`),
    print: () => navigate(`/labels/print?places=${id}`),
    printContents: () => navigate(`/labels/print?items=${(q.data?.items ?? []).filter((i) => i.code).map((i) => i.id).join(",")}`),
    allItems: () => navigate(`/items?locationId=${id}`),
    openItem: (it: Item) => navigate(`/items/${it.id}`),
    onDelta: (it: Item, d: number) => void adjustItem(it, d),
    moveOpen,
    setMoveOpen,
    moveTo: async (p: Place | null) => {
      setMoveOpen(false);
      if (!place) return;
      try {
        await api.updatePlace(place.id, { parentId: p?.id ?? null });
        refreshAll();
        toast(`${place.name} → ${p ? p.name : "top level"}`, { tone: "success" });
      } catch (e) {
        toast(errorMessage(e), { tone: "error" });
      }
    },
    assignLabel: async () => {
      if (!place) return;
      const raw = await scanner.pick({ title: "Scan the box label", hint: `Stick a label on “${place.name}” and scan it` });
      if (!raw) return;
      try {
        await api.updatePlace(place.id, { code: raw });
        refreshAll();
        toast("Label assigned", { tone: "success" });
      } catch (e) {
        toast(errorMessage(e), { tone: "error" });
      }
    },
  };
}
