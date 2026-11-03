import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LabelData } from "./inventory-api";
import { useInventoryContext } from "./inventory-provider";
import { LABEL_SIZES } from "./label-card";

export interface LabelRequest {
  kind: "item" | "location";
  ids?: string[];
}

export function useLabels(request: LabelRequest | null) {
  const inv = useInventoryContext();
  const [kind, setKind] = useState<"item" | "location">("item");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sizeId, setSizeId] = useState(LABEL_SIZES[0].id);
  const [copies, setCopies] = useState(1);

  useEffect(() => {
    if (!request) return;
    setKind(request.kind);
    setSelected(new Set(request.ids ?? []));
  }, [request]);

  const labels = useQuery({
    queryKey: ["inventory", inv.id, "labels", kind],
    queryFn: () => api<{ labels: LabelData[] }>(`/api/inventory/${inv.id}/labels?kind=${kind}`),
    enabled: !!inv.id && !!request,
  });
  const all = labels.data?.labels ?? [];
  const chosen = useMemo(() => all.filter((l) => selected.has(l.id)), [all, selected]);
  const size = LABEL_SIZES.find((s) => s.id === sizeId) ?? LABEL_SIZES[0];

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return {
    kind,
    changeKind: (next: "item" | "location") => {
      setKind(next);
      setSelected(new Set());
    },
    loading: labels.isPending,
    all,
    chosen,
    selected,
    toggle,
    selectAll: () => setSelected(new Set(all.map((l) => l.id))),
    selectNone: () => setSelected(new Set()),
    size,
    sizeId,
    setSizeId,
    copies,
    setCopies: (n: number) => setCopies(Math.min(Math.max(Math.round(n) || 1, 1), 50)),
  };
}
