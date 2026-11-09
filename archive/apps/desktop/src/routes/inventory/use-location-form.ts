import { useMemo, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { inventoryErrorMessage, type LocationFormTarget } from "./inventory-api";
import { useInventoryContext } from "./inventory-provider";
import { buildLocationTree, descendantIds } from "./location-tree";

export function useLocationForm(target: LocationFormTarget, onDone: () => void) {
  const inv = useInventoryContext();
  const [error, setError] = useState<string | null>(null);
  const locations = inv.locations.data?.locations ?? [];
  const { location } = target;

  const exclude = useMemo(() => (location ? descendantIds(buildLocationTree(locations), location.id) : new Set<string>()), [locations, location]);

  const form = useForm({
    defaultValues: {
      title: location?.title ?? "",
      kind: location?.kind ?? (target.parentId ? "box" : "warehouse"),
      parentId: location?.parentId ?? target.parentId ?? "",
      description: location?.description ?? "",
      images: location?.images ?? ([] as string[]),
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const props = { kind: value.kind || null, parent: value.parentId || null, description: value.description.trim() || null, images: value.images };
      try {
        let id: string;
        if (location) {
          await inv.updateLocation.mutateAsync({ locationId: location.id, title: value.title.trim(), props });
          id = location.id;
        } else {
          id = (await inv.createLocation.mutateAsync({ title: value.title.trim(), props })).noteId;
        }
        target.onSaved?.(id);
        onDone();
      } catch (e) {
        setError(inventoryErrorMessage(e));
      }
    },
  });

  return { form, error, locations, exclude, upload: inv.uploadImage };
}
