import { AlertTriangle, Boxes, Download, Loader2, MapPinned, Plus, Printer, ScanLine, Search, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ImportDialog } from "./import-dialog";
import type { InventoryTab } from "./use-inventory";
import { ItemDetail } from "./item-detail";
import { ItemFormDialog } from "./item-form-dialog";
import { ItemsView } from "./items-view";
import { LabelsDialog } from "./labels-dialog";
import { LocationFormDialog } from "./location-form-dialog";
import { LocationsView } from "./locations-view";
import { LogView } from "./log-view";
import { ScanDialog } from "./scan-dialog";
import { useInventoryScene } from "./use-inventory-scene";

const TABS: { id: InventoryTab; label: string }[] = [
  { id: "items", label: "Items" },
  { id: "locations", label: "Locations" },
  { id: "log", label: "Activity" },
];

function Stat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className={cn("bg-card rounded-lg border px-3 py-2", warn && "border-destructive/40")}>
      <p className="text-muted-foreground text-[11px] tracking-wider uppercase">{label}</p>
      <p className={cn("text-lg font-semibold tabular-nums", warn && "text-destructive")}>{value}</p>
    </div>
  );
}

export function InventoryScene() {
  const s = useInventoryScene();
  const { inv } = s;
  const summary = inv.summary.data;

  if (inv.inventories.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!inv.inventory) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Boxes size={40} className="text-muted-foreground/50" />
        <h1 className="text-xl font-semibold">Create your first inventory</h1>
        <p className="text-muted-foreground max-w-sm text-sm">An inventory keeps items, storage locations and an activity log together. Barcodes are generated automatically.</p>
        <form
          className="flex w-full max-w-xs gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (s.newName.trim()) inv.createInventory.mutate(s.newName.trim());
          }}
        >
          <Input autoFocus placeholder="Name (e.g. Workshop)" value={s.newName} onChange={(e) => s.setNewName(e.target.value)} />
          <Button type="submit" disabled={!s.newName.trim() || inv.createInventory.isPending}>
            Create
          </Button>
        </form>
        {inv.createInventory.isError ? <p className="text-destructive text-sm">{inv.createInventory.error.message}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="space-y-3 border-b p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-xl font-semibold">{inv.inventory.name}</h1>
          <Button size="sm" variant="outline" onClick={() => s.setScanOpen(true)}>
            <ScanLine /> Scan
          </Button>
          <Button size="sm" variant="outline" onClick={() => s.printLabels({ kind: "item" })}>
            <Printer /> Labels
          </Button>
          <Button size="sm" variant="outline" onClick={() => s.setImportOpen(true)}>
            <Upload /> Import
          </Button>
          <Button size="sm" variant="outline" onClick={() => void s.exportCsv()}>
            <Download /> Export
          </Button>
          <Button size="sm" variant="outline" onClick={() => s.editLocation({ location: null })}>
            <MapPinned /> New location
          </Button>
          <Button size="sm" onClick={() => s.newItem()}>
            <Plus /> New item
          </Button>
        </div>
        {s.exportError ? <p className="text-destructive text-xs">{s.exportError}</p> : null}

        {summary ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Items" value={summary.items} />
            <Stat label="Total units" value={Math.round(summary.quantity * 100) / 100} />
            <Stat label="Stock value" value={summary.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
            <Stat label="Low stock" value={summary.lowStock} warn={summary.lowStock > 0} />
            <Stat label="No location" value={summary.unplaced} />
            <Stat label="Expiring ≤ 30d" value={summary.expiring} warn={summary.expiring > 0} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border text-sm">
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => inv.setTab(t.id)} className={cn("px-3 py-1.5", inv.tab === t.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
                {t.label}
              </button>
            ))}
          </div>
          {inv.tab === "items" ? (
            <>
              <div className="relative min-w-48 flex-1 sm:max-w-sm">
                <Search size={14} className="text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2" />
                <Input className="h-8 pl-8" placeholder="Search title, barcode, SKU, location…" value={inv.query} onChange={(e) => inv.setQuery(e.target.value)} />
              </div>
              {s.filterLabel ? (
                <button type="button" onClick={() => inv.setFilter({ kind: "all" })} className="bg-accent/60 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs">
                  {inv.filter.kind === "low" ? <AlertTriangle size={12} /> : null}
                  {s.filterLabel}
                  <X size={12} />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        {inv.tab === "items" ? <ItemsView /> : null}
        {inv.tab === "locations" ? <LocationsView onEdit={s.editLocation} onPrintLabel={s.printLocationLabel} /> : null}
        {inv.tab === "log" ? <LogView /> : null}
      </main>

      <ItemDetail key={s.openItem?.id ?? "none"} item={s.openItem} onClose={() => inv.setOpenItemId(null)} onEdit={s.editItem} onPrintLabel={s.printItemLabel} />
      <ItemFormDialog key={s.itemForm?.item?.id ?? (s.itemForm ? "new" : "closed")} open={!!s.itemForm} item={s.itemForm?.item ?? null} preset={s.itemForm?.preset} onClose={s.closeItemForm} />
      <LocationFormDialog key={s.locationForm?.location?.id ?? s.locationForm?.parentId ?? "loc"} target={s.locationForm} onClose={() => s.editLocation(null)} />
      <LabelsDialog request={s.labels} onClose={() => s.printLabels(null)} />
      <ImportDialog open={s.importOpen} onClose={() => s.setImportOpen(false)} />
      <ScanDialog
        open={s.scanOpen}
        onClose={() => s.setScanOpen(false)}
        onOpenItem={(id) => {
          s.setScanOpen(false);
          inv.setTab("items");
          inv.setOpenItemId(id);
        }}
        onShowLocation={(id) => {
          s.setScanOpen(false);
          inv.setFilter({ kind: "location", locationId: id });
          inv.setTab("items");
        }}
        onCreateWithBarcode={(code) => {
          s.setScanOpen(false);
          s.newItem({ extBarcode: code });
        }}
      />
    </div>
  );
}
