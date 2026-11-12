import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { refreshAll } from "../lib/actions";
import { api } from "../lib/api";
import { pathText } from "../lib/format";
import { useQuery } from "../lib/query";
import { useRoute } from "../lib/router";
import { toast } from "../lib/toast";
import { Page, PageHeader, Spinner, btn } from "../ui/Page";
import type { LabelSpec } from "./layouts";
import { PrintStudio } from "./PrintStudio";

/** Named labels for specific items (?items=a,b) and/or places (?places=x,y). */
export function PrintLabelsPage() {
  const { query } = useRoute();
  const itemIds = useMemo(() => (query.get("items") ?? "").split(",").filter(Boolean), [query]);
  const placeIds = useMemo(() => (query.get("places") ?? "").split(",").filter(Boolean), [query]);
  const items = useQuery(itemIds.length ? `items?print=${itemIds.join(",")}` : null, () => api.items({}));
  const places = useQuery("places", api.places);
  const [busy, setBusy] = useState(false);

  const selectedItems = (items.data?.items ?? []).filter((i) => itemIds.includes(i.id));
  const selectedPlaces = (places.data?.locations ?? []).filter((p) => placeIds.includes(p.id));
  const unlabeled = [...selectedItems.filter((i) => !i.code), ...selectedPlaces.filter((p) => !p.code)];

  const labels: LabelSpec[] = [
    ...selectedPlaces.filter((p) => p.code).map((p) => ({ code: p.code!, display: p.codeDisplay!, title: p.name, subtitle: pathText(p.path.slice(0, -1)) })),
    ...selectedItems.filter((i) => i.code).map((i) => ({ code: i.code!, display: i.codeDisplay!, title: i.name, subtitle: pathText(i.locationPath) })),
  ];

  const labelAll = async () => {
    setBusy(true);
    try {
      for (const i of selectedItems.filter((x) => !x.code)) await api.updateItem(i.id, { autoCode: true });
      for (const p of selectedPlaces.filter((x) => !x.code)) await api.updatePlace(p.id, { autoCode: true });
      refreshAll();
      toast(`Generated ${unlabeled.length} label${unlabeled.length === 1 ? "" : "s"}`, { tone: "success" });
    } finally {
      setBusy(false);
    }
  };

  if ((itemIds.length && items.loading) || places.loading) return <Spinner />;
  return (
    <Page wide>
      <PageHeader onBack title="Print labels" subtitle={`${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"}, ${selectedPlaces.length} place${selectedPlaces.length === 1 ? "" : "s"}`} />
      <PrintStudio labels={labels}>
        {unlabeled.length > 0 && (
          <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <div>
              <b>{unlabeled.length}</b> selected {unlabeled.length === 1 ? "has" : "have"} no label yet.
            </div>
            <button className={btn.primary} disabled={busy} onClick={() => void labelAll()}>
              <Sparkles className="size-4" /> Generate labels for them
            </button>
          </div>
        )}
      </PrintStudio>
    </Page>
  );
}
