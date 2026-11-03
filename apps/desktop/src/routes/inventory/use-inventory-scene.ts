import { useMemo, useState } from "react";
import type { InventoryItem, InventoryLocation } from "./inventory-api";
import type { ItemFormValues } from "./use-item-form";
import type { LabelRequest } from "./use-labels";
import { useInventoryContext } from "./inventory-provider";
import { downloadItemsCsv } from "./use-import";

export function useInventoryScene() {
  const inv = useInventoryContext();
  const [itemForm, setItemForm] = useState<{ item: InventoryItem | null; preset: Partial<ItemFormValues> } | null>(null);
  const [labels, setLabels] = useState<LabelRequest | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const filterLabel = useMemo(() => {
    const f = inv.filter;
    if (f.kind === "low") return "Low stock";
    if (f.kind === "unplaced") return "No location";
    if (f.kind === "group") return `Group: ${f.group}`;
    if (f.kind === "location") return inv.locations.data?.locations.find((l) => l.id === f.locationId)?.path ?? "Location";
    return null;
  }, [inv.filter, inv.locations.data]);

  const exportCsv = async () => {
    if (!inv.id || !inv.inventory) return;
    setExportError(null);
    try {
      await downloadItemsCsv(inv.id, inv.inventory.name);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed");
    }
  };

  return {
    inv,
    itemForm,
    newItem: (preset: Partial<ItemFormValues> = {}) => setItemForm({ item: null, preset }),
    editItem: (item: InventoryItem) => setItemForm({ item, preset: {} }),
    closeItemForm: (noteId?: string) => {
      const created = itemForm && !itemForm.item && noteId;
      setItemForm(null);
      if (created) inv.setOpenItemId(noteId);
    },
    locationForm: inv.locationForm,
    editLocation: inv.setLocationForm,
    labels,
    printLabels: setLabels,
    printItemLabel: (item: InventoryItem) => setLabels({ kind: "item", ids: [item.id] }),
    printLocationLabel: (location: InventoryLocation) => setLabels({ kind: "location", ids: [location.id] }),
    scanOpen,
    setScanOpen,
    importOpen,
    setImportOpen,
    exportCsv,
    exportError,
    openItem: inv.openItem,
    filterLabel,
    newName,
    setNewName,
  };
}
