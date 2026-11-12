import { useState } from "react";
import { adjustItem, moveItemsTo, refreshAll } from "../../lib/actions";
import { api, errorMessage } from "../../lib/api";
import { useQuery } from "../../lib/query";
import { navigate } from "../../lib/router";
import { toast } from "../../lib/toast";
import type { Place } from "../../lib/types";
import { useScanner } from "../../scanner/ScanContext";

/** Holding hook for <ItemDetail>. */
export function useItemDetail(id: string) {
  const q = useQuery(`item:${id}`, () => api.item(id));
  const scanner = useScanner();
  const [photo, setPhoto] = useState(0);
  const [moveOpen, setMoveOpen] = useState(false);
  const [setQtyOpen, setSetQtyOpen] = useState(false);
  const item = q.data?.item;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      refreshAll();
      if (ok) toast(ok, { tone: "success" });
    } catch (e) {
      toast(errorMessage(e), { tone: "error" });
    }
  };

  return {
    item,
    activity: q.data?.activity ?? [],
    loading: q.loading,
    notFound: !!q.error,
    photo,
    setPhoto,
    delta: (d: number) => item && void adjustItem(item, d),
    setQtyOpen,
    setSetQtyOpen,
    setExact: (n: number) => item && void run(() => api.adjust(item.id, { set: n }), `Set to ${n}`).then(() => setSetQtyOpen(false)),
    moveOpen,
    setMoveOpen,
    moveTo: (p: Place | null) => {
      setMoveOpen(false);
      if (item) void moveItemsTo([item], p);
    },
    scanMove: async () => {
      if (!item) return;
      const raw = await scanner.pick({ title: `Move “${item.name}”`, hint: "Scan the destination box / place label" });
      if (!raw) return;
      const res = await api.resolve(raw).catch(() => null);
      const loc = res?.matches.find((m) => m.type === "location");
      if (loc?.type === "location") void moveItemsTo([item], loc.location);
      else toast("That isn't a place label.", { tone: "error" });
    },
    assignLabel: async () => {
      if (!item) return;
      const raw = await scanner.pick({ title: "Scan the new label", hint: `Stick a fresh label on “${item.name}” and scan it` });
      if (raw) void run(() => api.updateItem(item.id, { code: raw }), "Label assigned");
    },
    autoLabel: () => item && void run(() => api.updateItem(item.id, { autoCode: true }), "Fresh label generated"),
    toggleFavorite: () => item && void run(() => api.updateItem(item.id, { favorite: !item.favorite })),
    print: () => item && navigate(`/labels/print?items=${item.id}`),
    edit: () => navigate(`/items/${id}/edit`),
    duplicate: () => {
      if (!item) return;
      const p = new URLSearchParams({ category: item.category });
      if (item.locationId) p.set("loc", item.locationId);
      navigate(`/items/new?${p}`);
    },
  };
}
