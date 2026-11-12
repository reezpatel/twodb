import type { Activity, BatchCode, CodeBatch, Item, ItemInput, Place, PlaceInput, ResolveResult, Stats } from "./types";

// Thin client over TwoThing's API, served behind the Gateway at
// /apps/twothing (Vite proxies in dev). Session cookies carry auth.
export const BASE = "/apps/twothing";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: unknown,
  ) {
    super(code);
  }
}

async function req<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(BASE + path, {
    credentials: "include",
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? `http_${res.status}`, body.detail);
  }
  return res.json() as Promise<T>;
}

const qs = (o: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export interface ItemQuery {
  q?: string;
  category?: string;
  locationId?: string;
  tag?: string;
  low?: boolean;
  unplaced?: boolean;
  favorite?: boolean;
  sort?: "name" | "updated" | "created" | "quantity";
}

export const api = {
  stats: () => req<Stats>("/stats"),

  items: (q: ItemQuery = {}) => req<{ items: Item[] }>(`/items${qs({ ...q })}`),
  item: (id: string) => req<{ item: Item; activity: Activity[] }>(`/items/${id}`),
  createItem: (input: ItemInput) => req<Item>("/items", { method: "POST", json: input }),
  updateItem: (id: string, patch: ItemInput) => req<Item>(`/items/${id}`, { method: "PATCH", json: patch }),
  deleteItem: (id: string) => req<{ ok: boolean }>(`/items/${id}`, { method: "DELETE" }),
  adjust: (id: string, body: { delta?: number; set?: number; reason?: string }) => req<Item>(`/items/${id}/adjust`, { method: "POST", json: body }),
  moveItems: (itemIds: string[], locationId: string | null) => req<{ moved: number }>("/items/move", { method: "POST", json: { itemIds, locationId } }),
  tags: () => req<{ tags: { tag: string; n: number }[] }>("/tags"),

  places: () => req<{ locations: Place[]; unplacedCount: number }>("/locations"),
  place: (id: string) => req<{ location: Place; children: Place[]; items: Item[]; activity: Activity[] }>(`/locations/${id}`),
  createPlace: (input: PlaceInput) => req<Place>("/locations", { method: "POST", json: input }),
  updatePlace: (id: string, patch: PlaceInput) => req<Place>(`/locations/${id}`, { method: "PATCH", json: patch }),
  deletePlace: (id: string, moveContentsUp = false) => req<{ ok: boolean }>(`/locations/${id}${moveContentsUp ? "?contents=parent" : ""}`, { method: "DELETE" }),

  resolve: (code: string) => req<ResolveResult>(`/resolve${qs({ code })}`),
  generateCodes: (count: number, note?: string) =>
    req<{ batchId: string; codes: { code: string; display: string }[]; reissueWindowDays: number }>("/codes/generate", { method: "POST", json: { count, note } }),
  nextCode: () => req<{ code: string; display: string }>("/codes/next", { method: "POST" }),
  batches: () => req<{ batches: CodeBatch[]; pool: { free: number; fresh: number }; reissueWindowDays: number }>("/codes/batches"),
  batch: (id: string) => req<{ batch: Omit<CodeBatch, "live" | "used">; codes: BatchCode[] }>(`/codes/batches/${id}`),

  activity: (opts: { target?: string; before?: string; limit?: number } = {}) => req<{ entries: Activity[] }>(`/activity${qs(opts)}`),

  uploadImage: (blob: Blob) => req<{ id: string }>("/images", { method: "POST", body: blob, headers: { "content-type": blob.type || "image/jpeg" } }),
  imageUrl: (id: string) => `${BASE}/images/${id}`,
  exportUrl: () => `${BASE}/export.csv`,
  importCsv: (csv: string, dryRun: boolean) =>
    req<{ created: number; errors: { row: number; error: string }[]; dryRun: boolean; columns: (string | null)[] }>("/import", { method: "POST", json: { csv, dryRun } }),
};

/** Human message for an API error code. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.detail as { kind?: string; name?: string; message?: string } | undefined;
    switch (e.code) {
      case "code_in_use":
        return `That label is already on ${d?.kind === "location" ? "place" : "item"} “${d?.name ?? "?"}”.`;
      case "cycle":
        return "A place can't go inside itself.";
      case "location_not_empty":
        return "This place isn't empty.";
      case "unauthorized":
        return "You're signed out.";
      case "invalid_request":
        return "Some fields are invalid.";
      default:
        return d?.message ?? e.code.replace(/_/g, " ");
    }
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}
