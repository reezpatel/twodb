// Mirrors the backend DTOs (apps/twothing/src/lib/*.ts, ENDPOINTS.md).

export interface Crumb {
  id: string;
  name: string;
  kind: string;
}

export interface Item {
  id: string;
  code: string | null;
  codeDisplay: string | null;
  name: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  minQuantity: number | null;
  low: boolean;
  locationId: string | null;
  locationPath: Crumb[];
  tags: string[];
  barcodes: string[];
  specs: Record<string, string>;
  imageIds: string[];
  mpn: string;
  manufacturer: string;
  supplier: string;
  unitCost: number | null;
  purchaseUrl: string;
  datasheetUrl: string;
  notes: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ItemInput = Partial<Omit<Item, "id" | "codeDisplay" | "low" | "locationPath" | "createdAt" | "updatedAt">> & { autoCode?: boolean };

export interface Place {
  id: string;
  code: string | null;
  codeDisplay: string | null;
  name: string;
  kind: string;
  parentId: string | null;
  description: string;
  color: string | null;
  imageId: string | null;
  path: Crumb[];
  depth: number;
  itemCount: number;
  totalItemCount: number;
  childCount: number;
  createdAt: string;
  updatedAt: string;
}

export type PlaceInput = Partial<Pick<Place, "name" | "kind" | "parentId" | "description" | "color" | "imageId" | "code">> & { autoCode?: boolean };

export interface Activity {
  id: string;
  targetKind: "item" | "location";
  targetId: string;
  targetName: string;
  action: "created" | "updated" | "quantity" | "moved" | "labeled" | "deleted" | "imported";
  detail: Record<string, unknown>;
  userId: string | null;
  at: string;
}

export type ResolveMatch =
  | { type: "item"; via: "label" | "barcode"; item: Item }
  | { type: "location"; location: Place }
  | { type: "free_code"; code: string; display: string; inPool: boolean; generatedAt: string | null };

export interface ResolveResult {
  raw: string;
  code: string | null;
  matches: ResolveMatch[];
}

export interface Stats {
  totals: { items: number; units: number; value: number; low: number; unplaced: number; unlabeled: number; locations: number };
  categories: { category: string; n: number; value: number }[];
  lowStock: Item[];
  recent: Item[];
  favorites: Item[];
  activity: Activity[];
}

export interface CodeBatch {
  id: string;
  count: number;
  note: string;
  createdAt: string;
  live: number;
  used: number;
}

export interface BatchCode {
  code: string;
  display: string;
  usedBy: { kind: "item" | "location"; id: string; name: string | null } | null;
}
