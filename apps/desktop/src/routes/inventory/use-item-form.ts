import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { fromDateInput, inventoryErrorMessage, toDateInput, type InventoryItem } from "./inventory-api";
import { useInventoryContext } from "./inventory-provider";

export interface ItemFormValues {
  title: string;
  description: string;
  quantity: string;
  unit: string;
  minQuantity: string;
  locationId: string;
  groups: string[];
  images: string[];
  sku: string;
  extBarcode: string;
  supplier: string;
  unitCost: string;
  purchasedAt: string;
  expiresAt: string;
  productUrl: string;
}

const numberOrNull = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
const textOrNull = (v: string) => (v.trim() === "" ? null : v.trim());

function defaults(item: InventoryItem | null, preset: Partial<ItemFormValues>): ItemFormValues {
  return {
    title: item?.title ?? "",
    description: item?.description ?? "",
    quantity: item ? String(item.quantity) : "1",
    unit: item?.unit ?? "",
    minQuantity: item?.minQuantity != null ? String(item.minQuantity) : "",
    locationId: item?.locationId ?? "",
    groups: item?.groups ?? [],
    images: item?.images ?? [],
    sku: item?.sku ?? "",
    extBarcode: item?.extBarcode ?? "",
    supplier: item?.supplier ?? "",
    unitCost: item?.unitCost != null ? String(item.unitCost) : "",
    purchasedAt: toDateInput(item?.purchasedAt ?? null),
    expiresAt: toDateInput(item?.expiresAt ?? null),
    productUrl: item?.productUrl ?? "",
    ...preset,
  };
}

export function useItemForm(item: InventoryItem | null, preset: Partial<ItemFormValues>, onDone: (noteId?: string) => void) {
  const inv = useInventoryContext();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: defaults(item, preset),
    onSubmit: async ({ value }) => {
      setError(null);
      const props = {
        description: textOrNull(value.description),
        quantity: numberOrNull(value.quantity) ?? 0,
        unit: textOrNull(value.unit),
        min_quantity: numberOrNull(value.minQuantity),
        location: value.locationId || null,
        groups: value.groups,
        images: value.images,
        sku: textOrNull(value.sku),
        ext_barcode: textOrNull(value.extBarcode),
        supplier: textOrNull(value.supplier),
        unit_cost: numberOrNull(value.unitCost),
        purchased_at: fromDateInput(value.purchasedAt),
        expires_at: fromDateInput(value.expiresAt),
        product_url: textOrNull(value.productUrl),
      };
      try {
        if (item) {
          await inv.updateItem.mutateAsync({ itemId: item.id, title: value.title.trim(), props });
          onDone(item.id);
        } else {
          const created = await inv.createItem.mutateAsync({ title: value.title.trim(), props });
          onDone(created.noteId);
        }
      } catch (e) {
        setError(inventoryErrorMessage(e));
      }
    },
  });

  return {
    form,
    error,
    locations: inv.locations.data?.locations ?? [],
    groupNames: (inv.groups.data?.groups ?? []).map((g) => g.name),
    upload: inv.uploadImage,
    newLocation: (onSaved: (id: string) => void) => inv.setLocationForm({ location: null, onSaved }),
  };
}
