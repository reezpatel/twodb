import { useEffect } from "react";
import { ActivityPage } from "../activity/ActivityPage";
import { Dashboard } from "../dashboard/Dashboard";
import { ItemDetail } from "../items/ItemDetail";
import { ItemEditor } from "../items/ItemEditor";
import { ItemsPage } from "../items/ItemsPage";
import { BatchPage } from "../labels/BatchPage";
import { LabelsPage } from "../labels/LabelsPage";
import { PrintLabelsPage } from "../labels/PrintLabelsPage";
import { useRoute } from "../lib/router";
import { PlaceDetail } from "../places/PlaceDetail";
import { PlaceEditor } from "../places/PlaceEditor";
import { PlacesPage } from "../places/PlacesPage";
import { ResolvePage } from "../resolve/ResolvePage";
import { SettingsPage } from "../settings/SettingsPage";

export function Routes() {
  const r = useRoute();
  const [a, b, c] = r.segments;

  useEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0 });
  }, [r.path]);

  switch (a) {
    case undefined:
      return <Dashboard />;
    case "items":
      if (b === "new") return <ItemEditor key={r.query.toString()} />;
      if (b && c === "edit") return <ItemEditor key={b} id={b} />;
      if (b) return <ItemDetail key={b} id={b} />;
      return <ItemsPage />;
    case "places":
      if (b === "new") return <PlaceEditor key={r.query.toString()} />;
      if (b && c === "edit") return <PlaceEditor key={b} id={b} />;
      if (b) return <PlaceDetail key={b} id={b} />;
      return <PlacesPage />;
    case "labels":
      if (b === "batch" && c) return <BatchPage key={c} id={c} />;
      if (b === "print") return <PrintLabelsPage />;
      return <LabelsPage />;
    case "activity":
      return <ActivityPage />;
    case "settings":
      return <SettingsPage />;
    case "c":
      return <ResolvePage key={b} code={decodeURIComponent(b ?? "")} />;
    default:
      return <div className="p-10 text-center text-ink-muted">Page not found.</div>;
  }
}
