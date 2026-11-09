import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { apiFetch } from "@/lib/native";
import {
  inventoryKeys,
  type Inventory,
  type InventoryItem,
  type InventoryLocation,
  type InventorySummary,
  type ItemFilter,
  type LocationFormTarget,
  type LogEntry,
} from "./inventory-api";

const ACTIVE_KEY = "twodb.inventory.active";

export type InventoryTab = "items" | "locations" | "log";

export type RowProps = Record<string, unknown>;

export function useInventory() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem(ACTIVE_KEY));
  const [tab, setTab] = useState<InventoryTab>("items");
  const [filter, setFilter] = useState<ItemFilter>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [locationForm, setLocationForm] = useState<LocationFormTarget | null>(null);
  const deferredQuery = useDeferredValue(query.trim());

  const inventories = useQuery({
    queryKey: inventoryKeys.list,
    queryFn: () => api<{ inventories: Inventory[] }>("/api/inventory"),
  });
  const list = inventories.data?.inventories ?? [];
  const inventory = list.find((i) => i.id === activeId) ?? list[0] ?? null;
  const id = inventory?.id ?? null;

  useEffect(() => {
    if (inventory && inventory.id !== activeId) setActiveId(inventory.id);
  }, [inventory, activeId]);

  const selectInventory = useCallback((next: string) => {
    localStorage.setItem(ACTIVE_KEY, next);
    setActiveId(next);
    setFilter({ kind: "all" });
    setQuery("");
    setOpenItemId(null);
  }, []);

  const itemParams = new URLSearchParams();
  if (deferredQuery) itemParams.set("q", deferredQuery);
  if (filter.kind === "low") itemParams.set("low", "1");
  if (filter.kind === "unplaced") itemParams.set("unplaced", "1");
  if (filter.kind === "group") itemParams.set("group", filter.group);
  if (filter.kind === "location") itemParams.set("location", filter.locationId);

  const items = useQuery({
    queryKey: [...inventoryKeys.items(id), itemParams.toString()],
    queryFn: () => api<{ items: InventoryItem[] }>(`/api/inventory/${id}/items?${itemParams}`),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });

  const openItem = useQuery({
    queryKey: [...inventoryKeys.items(id), "one", openItemId],
    queryFn: () => api<{ item: InventoryItem }>(`/api/inventory/${id}/items/${openItemId}`).then((r) => r.item),
    enabled: !!id && !!openItemId,
  });

  const locations = useQuery({
    queryKey: inventoryKeys.locations(id),
    queryFn: () => api<{ locations: InventoryLocation[] }>(`/api/inventory/${id}/locations`),
    enabled: !!id,
  });

  const groups = useQuery({
    queryKey: inventoryKeys.groups(id),
    queryFn: () => api<{ groups: { name: string; count: number }[] }>(`/api/inventory/${id}/groups`),
    enabled: !!id,
  });

  const summary = useQuery({
    queryKey: inventoryKeys.summary(id),
    queryFn: () => api<InventorySummary>(`/api/inventory/${id}/summary`),
    enabled: !!id,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["inventory", id] });

  const createInventory = useMutation({
    mutationFn: (name: string) => api<Inventory>("/api/inventory", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.list });
      selectInventory(created.id);
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const rows = (database: string | undefined) => `/api/notes/databases/${database}/rows`;

  const createItem = useMutation({
    mutationFn: (v: { title: string; props: RowProps }) => api<{ noteId: string }>(rows(inventory?.items), { method: "POST", body: JSON.stringify(v) }),
    onSuccess: invalidate,
  });

  const updateItem = useMutation({
    mutationFn: ({ itemId, ...patch }: { itemId: string; title?: string; props?: RowProps }) =>
      api(`${rows(inventory?.items)}/${itemId}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => api(`${rows(inventory?.items)}/${itemId}`, { method: "DELETE" }),
    onSuccess: () => {
      setOpenItemId(null);
      invalidate();
    },
  });

  const adjust = useMutation({
    mutationFn: ({ itemId, ...op }: { itemId: string; delta?: number; set?: number; reason?: string }) =>
      api<{ quantity: number; previous: number }>(`/api/inventory/${id}/items/${itemId}/adjust`, { method: "POST", body: JSON.stringify(op) }),
    onSuccess: invalidate,
  });

  const move = useMutation({
    mutationFn: ({ itemId, locationId, reason }: { itemId: string; locationId: string | null; reason?: string }) =>
      api(`/api/inventory/${id}/items/${itemId}/move`, { method: "POST", body: JSON.stringify({ locationId, reason }) }),
    onSuccess: invalidate,
  });

  const createLocation = useMutation({
    mutationFn: (v: { title: string; props: RowProps }) => api<{ noteId: string }>(rows(inventory?.locations), { method: "POST", body: JSON.stringify(v) }),
    onSuccess: invalidate,
  });

  const updateLocation = useMutation({
    mutationFn: ({ locationId, ...patch }: { locationId: string; title?: string; props?: RowProps }) =>
      api(`${rows(inventory?.locations)}/${locationId}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: invalidate,
  });

  const deleteLocation = useMutation({
    mutationFn: (locationId: string) => api(`${rows(inventory?.locations)}/${locationId}`, { method: "DELETE" }),
    onSuccess: () => {
      setFilter((f) => (f.kind === "location" ? { kind: "all" } : f));
      invalidate();
    },
  });

  const uploadImage = useCallback(
    async (file: File): Promise<string> => {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch(`/api/inventory/${id}/uploads`, { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok || !body?.id) throw new Error(body?.error ?? `upload failed (${res.status})`);
      return body.id;
    },
    [id],
  );

  return {
    inventories,
    inventory,
    id,
    selectInventory,
    tab,
    setTab,
    filter,
    setFilter,
    query,
    setQuery,
    openItemId,
    setOpenItemId,
    locationForm,
    setLocationForm,
    items,
    openItem: openItemId ? (openItem.data ?? null) : null,
    locations,
    groups,
    summary,
    createInventory,
    createItem,
    updateItem,
    deleteItem,
    adjust,
    move,
    createLocation,
    updateLocation,
    deleteLocation,
    uploadImage,
  };
}

export type InventoryHook = ReturnType<typeof useInventory>;

export function useInventoryLog(inventoryId: string | null, target: string | null, enabled = true) {
  return useQuery({
    queryKey: inventoryKeys.log(inventoryId, target),
    queryFn: () => api<{ entries: LogEntry[] }>(`/api/inventory/${inventoryId}/log?limit=200${target ? `&target=${target}` : ""}`),
    enabled: !!inventoryId && enabled,
  });
}
