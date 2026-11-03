export interface Inventory {
  id: string;
  name: string;
  sectionId: string;
  items: string;
  locations: string;
  log: string;
}

export interface InventoryItem {
  id: string;
  title: string;
  code: string | null;
  description: string | null;
  quantity: number;
  unit: string | null;
  minQuantity: number | null;
  lowStock: boolean;
  locationId: string | null;
  locationPath: string | null;
  images: string[];
  groups: string[];
  sku: string | null;
  extBarcode: string | null;
  supplier: string | null;
  unitCost: number | null;
  purchasedAt: string | null;
  expiresAt: string | null;
  productUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface InventoryLocation {
  id: string;
  title: string;
  code: string | null;
  kind: string | null;
  parentId: string | null;
  path: string;
  description: string | null;
  images: string[];
  itemCount: number;
  totalItems: number;
  childCount: number;
}

export interface Crumb {
  id: string;
  title: string;
  code: string | null;
  kind: string | null;
}

export interface LogEntry {
  id: string;
  title: string;
  target: string | null;
  targetKind: string | null;
  targetLabel: string | null;
  action: string | null;
  field: string | null;
  from: string | null;
  to: string | null;
  delta: number | null;
  actor: string | null;
  at: string | null;
  reason: string | null;
}

export interface InventorySummary {
  items: number;
  quantity: number;
  value: number;
  lowStock: number;
  unplaced: number;
  expiring: number;
  locations: number;
}

export type ResolveMatch =
  | { kind: "item"; id: string; databaseId: string; item: InventoryItem; breadcrumb: Crumb[] }
  | { kind: "location"; id: string; databaseId: string; location: InventoryLocation; breadcrumb: Crumb[] };

export interface LabelData {
  id: string;
  code: string;
  display: string;
  title: string;
  subtitle: string | null;
  kind: string | null;
}

export interface ImportResult {
  headers: string[];
  mapping: Record<string, string>;
  total: number;
  preview: string[][];
  created: number;
  updated: number;
  locationsCreated: number;
  errors: { row: number; error: string }[];
}

export interface LocationFormTarget {
  location: InventoryLocation | null;
  parentId?: string;
  /** Called with the new/edited location id after a successful save. */
  onSaved?: (id: string) => void;
}

export const LOCATION_KINDS = ["warehouse", "room", "rack", "shelf", "box", "other"] as const;

export type ItemFilter =
  | { kind: "all" }
  | { kind: "low" }
  | { kind: "unplaced" }
  | { kind: "group"; group: string }
  | { kind: "location"; locationId: string };

export const inventoryKeys = {
  all: ["inventory"] as const,
  list: ["inventory", "list"] as const,
  items: (id: string | null) => ["inventory", id, "items"] as const,
  locations: (id: string | null) => ["inventory", id, "locations"] as const,
  groups: (id: string | null) => ["inventory", id, "groups"] as const,
  summary: (id: string | null) => ["inventory", id, "summary"] as const,
  log: (id: string | null, target: string | null) => ["inventory", id, "log", target] as const,
};

const ERROR_MESSAGES: Record<string, string> = {
  insufficient_stock: "Not enough stock for that change",
  location_not_empty: "Location still holds items or sub-locations",
  location_cycle: "A location can't be moved inside itself",
  code_taken: "That barcode is already in use",
  code_immutable: "Barcodes can't be changed",
  invalid_location: "That location doesn't exist",
};

/** Human message for an API error thrown by `api()` ("error (status)" or "error"). */
export function inventoryErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const key = raw.split(/[ (:]/)[0];
  return ERROR_MESSAGES[key] ?? raw;
}

export function formatQuantity(item: Pick<InventoryItem, "quantity" | "unit">) {
  return `${Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(2)}${item.unit ? ` ${item.unit}` : ""}`;
}

/** ISO timestamp → yyyy-mm-dd in local time (what <input type="date"> expects). */
export function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** yyyy-mm-dd → local-midnight ISO timestamp (null when empty). */
export function fromDateInput(value: string): string | null {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}

export function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}
