import { useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useQuery } from "../../lib/query";
import { toast } from "../../lib/toast";
import type { Place } from "../../lib/types";
import { useScanner } from "../../scanner/ScanContext";

/** Holding hook for <PlacePickerDialog>: places query, fuzzy filter, scan-to-pick. */
export function usePlacePicker(opts: { exclude?: string; onPick: (p: Place | null) => void }) {
  const { data, loading } = useQuery("places", api.places);
  const [q, setQ] = useState("");
  const scanner = useScanner();

  const excluded = useMemo(() => {
    if (!opts.exclude || !data) return new Set<string>();
    // A place can't move inside itself or its own descendants.
    const out = new Set([opts.exclude]);
    for (const p of data.locations) if (p.path.some((c) => c.id === opts.exclude)) out.add(p.id);
    return out;
  }, [data, opts.exclude]);

  const list = useMemo(() => {
    const all = (data?.locations ?? []).filter((p) => !excluded.has(p.id));
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return all;
    return all.filter((p) => {
      const hay = `${p.path.map((c) => c.name).join(" ")} ${p.codeDisplay ?? ""} ${p.kind}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [data, q, excluded]);

  const scan = async () => {
    const raw = await scanner.pick({ title: "Scan a box / place label", hint: "The place will be selected" });
    if (!raw) return;
    const res = await api.resolve(raw);
    const loc = res.matches.find((m) => m.type === "location");
    if (loc?.type === "location") opts.onPick(loc.location);
    else toast("That code isn't a place label.", { tone: "error" });
  };

  return { q, setQ, list, loading, searching: q.trim().length > 0, scan };
}
