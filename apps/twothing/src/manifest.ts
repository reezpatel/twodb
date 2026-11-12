import { z } from "zod";
import { defineAppManifest, defineEndpoint } from "@twodb/core-platform/manifest";

// ---------------------------------------------------------------------------
// Shared schemas (mirrors the DTOs in src/lib/*.ts)
// ---------------------------------------------------------------------------

const crumb = z.object({ id: z.string(), name: z.string(), kind: z.string() });

const item = z.object({
  id: z.string(),
  code: z.string().nullable().describe("Our printed label code (canonical, e.g. K7QM2X)"),
  codeDisplay: z.string().nullable().describe("Display form, e.g. K7Q-M2X"),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  quantity: z.number(),
  unit: z.string(),
  minQuantity: z.number().nullable(),
  low: z.boolean(),
  locationId: z.string().nullable(),
  locationPath: z.array(crumb),
  tags: z.array(z.string()),
  barcodes: z.array(z.string()).describe("Manufacturer EAN/UPC/QR payloads found on the product"),
  specs: z.record(z.string(), z.string()),
  imageIds: z.array(z.string()),
  mpn: z.string(),
  manufacturer: z.string(),
  supplier: z.string(),
  unitCost: z.number().nullable(),
  purchaseUrl: z.string(),
  datasheetUrl: z.string(),
  notes: z.string(),
  favorite: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const itemInput = z.object({
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  minQuantity: z.number().nullable().optional(),
  locationId: z.string().nullable().optional(),
  code: z.string().nullable().optional().describe("Label code (scanned/typed); must not be on another item or place"),
  autoCode: z.boolean().optional().describe("Allocate a fresh pool code when `code` is empty"),
  tags: z.array(z.string()).optional(),
  barcodes: z.array(z.string()).optional(),
  specs: z.record(z.string(), z.string()).optional(),
  imageIds: z.array(z.string()).optional(),
  mpn: z.string().optional(),
  manufacturer: z.string().optional(),
  supplier: z.string().optional(),
  unitCost: z.number().nullable().optional(),
  purchaseUrl: z.string().optional(),
  datasheetUrl: z.string().optional(),
  notes: z.string().optional(),
  favorite: z.boolean().optional(),
});

const location = z.object({
  id: z.string(),
  code: z.string().nullable(),
  codeDisplay: z.string().nullable(),
  name: z.string(),
  kind: z.string(),
  parentId: z.string().nullable(),
  description: z.string(),
  color: z.string().nullable(),
  imageId: z.string().nullable(),
  path: z.array(crumb),
  depth: z.number(),
  itemCount: z.number(),
  totalItemCount: z.number(),
  childCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const locationInput = z.object({
  name: z.string(),
  kind: z.string().optional().describe("room | cabinet | shelf | rack | drawer | bin | box | organizer | bag | other"),
  parentId: z.string().nullable().optional(),
  description: z.string().optional(),
  color: z.string().nullable().optional(),
  imageId: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  autoCode: z.boolean().optional(),
});

const activity = z.object({
  id: z.string(),
  targetKind: z.string(),
  targetId: z.string(),
  targetName: z.string(),
  action: z.enum(["created", "updated", "quantity", "moved", "labeled", "deleted", "imported"]),
  detail: z.record(z.string(), z.unknown()),
  userId: z.string().nullable(),
  at: z.string(),
});

const ok = z.object({ ok: z.boolean() });
const auth = "session-or-apiKey" as const;

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

const endpoints = [
  defineEndpoint({
    name: "listItems",
    method: "GET",
    path: "/items",
    auth,
    description: "Search/filter items. `q` matches every term across name, label, specs, tags, part number and barcodes. `locationId` includes sub-places unless recursive=false.",
    request: z.object({
      q: z.string().optional(),
      category: z.string().optional(),
      locationId: z.string().optional(),
      recursive: z.string().optional(),
      tag: z.string().optional(),
      low: z.string().optional(),
      unplaced: z.string().optional(),
      favorite: z.string().optional(),
      sort: z.enum(["name", "updated", "created", "quantity"]).optional(),
      limit: z.string().optional(),
    }),
    response: z.object({ items: z.array(item) }),
  }),
  defineEndpoint({ name: "createItem", method: "POST", path: "/items", auth, description: "Creates an item. 409 code_in_use if the label is already on something.", request: itemInput, response: item }),
  defineEndpoint({
    name: "getItem",
    method: "GET",
    path: "/items/:id",
    auth,
    description: "One item plus its recent activity.",
    request: z.object({ id: z.string() }),
    response: z.object({ item, activity: z.array(activity) }),
  }),
  defineEndpoint({ name: "updateItem", method: "PATCH", path: "/items/:id", auth, description: "Partial update; changes are diffed into the activity log.", request: itemInput.partial().extend({ id: z.string() }), response: item }),
  defineEndpoint({ name: "deleteItem", method: "DELETE", path: "/items/:id", auth, description: "Deletes an item (its label code becomes free again after the re-issue window).", request: z.object({ id: z.string() }), response: ok }),
  defineEndpoint({
    name: "adjustQuantity",
    method: "POST",
    path: "/items/:id/adjust",
    auth,
    description: "Stock in/out: `delta` (+/-) or absolute `set`. Clamped at 0.",
    request: z.object({ id: z.string(), delta: z.number().optional(), set: z.number().optional(), reason: z.string().optional() }),
    response: item,
  }),
  defineEndpoint({
    name: "moveItems",
    method: "POST",
    path: "/items/move",
    auth,
    description: "Moves items into a place (null = unplaced). Used by scan put-away mode.",
    request: z.object({ itemIds: z.array(z.string()), locationId: z.string().nullable() }),
    response: z.object({ moved: z.number() }),
  }),
  defineEndpoint({ name: "listTags", method: "GET", path: "/tags", auth, description: "All tags with usage counts.", response: z.object({ tags: z.array(z.object({ tag: z.string(), n: z.number() })) }) }),

  // -------------------------------------------------------------------------
  // Locations
  // -------------------------------------------------------------------------
  defineEndpoint({
    name: "listLocations",
    method: "GET",
    path: "/locations",
    auth,
    description: "Every place in tree (depth-first) order with direct + recursive item counts.",
    response: z.object({ locations: z.array(location), unplacedCount: z.number() }),
  }),
  defineEndpoint({ name: "createLocation", method: "POST", path: "/locations", auth, description: "Creates a place (room/shelf/box…).", request: locationInput, response: location }),
  defineEndpoint({
    name: "getLocation",
    method: "GET",
    path: "/locations/:id",
    auth,
    description: "A place with its direct children, direct items and activity.",
    request: z.object({ id: z.string() }),
    response: z.object({ location, children: z.array(location), items: z.array(item), activity: z.array(activity) }),
  }),
  defineEndpoint({ name: "updateLocation", method: "PATCH", path: "/locations/:id", auth, description: "Partial update. Re-parenting into own subtree → 400 cycle.", request: locationInput.partial().extend({ id: z.string() }), response: location }),
  defineEndpoint({
    name: "deleteLocation",
    method: "DELETE",
    path: "/locations/:id",
    auth,
    description: "Deletes a place. Non-empty → 409 location_not_empty unless contents=parent (children + items move one level up).",
    request: z.object({ id: z.string(), contents: z.enum(["parent"]).optional() }),
    response: ok,
  }),

  // -------------------------------------------------------------------------
  // Label codes
  // -------------------------------------------------------------------------
  defineEndpoint({
    name: "generateCodes",
    method: "POST",
    path: "/codes/generate",
    auth,
    description:
      "Bulk-generates random (non-sequential) 6-char label codes for printing. A code is never handed out if it was generated in the last 7 days or is on any item/place.",
    request: z.object({ count: z.number().int().min(1).max(1000), note: z.string().optional() }),
    response: z.object({ batchId: z.string().nullable(), codes: z.array(z.object({ code: z.string(), display: z.string() })), reissueWindowDays: z.number() }),
  }),
  defineEndpoint({
    name: "nextCode",
    method: "POST",
    path: "/codes/next",
    auth,
    description: "Allocates a single fresh code (same uniqueness rules), not tied to a print batch.",
    response: z.object({ code: z.string(), display: z.string() }),
  }),
  defineEndpoint({
    name: "listCodeBatches",
    method: "GET",
    path: "/codes/batches",
    auth,
    description: "Print batches with how many of their codes are in use, plus pool totals.",
    response: z.object({
      batches: z.array(z.object({ id: z.string(), count: z.number(), note: z.string(), createdAt: z.string(), live: z.number(), used: z.number() })),
      pool: z.object({ free: z.number(), fresh: z.number() }),
      reissueWindowDays: z.number(),
    }),
  }),
  defineEndpoint({
    name: "getCodeBatch",
    method: "GET",
    path: "/codes/batches/:id",
    auth,
    description: "Codes in a batch (for re-printing) and what each is used by.",
    request: z.object({ id: z.string() }),
    response: z.object({
      batch: z.object({ id: z.string(), count: z.number(), note: z.string(), createdAt: z.string() }),
      codes: z.array(z.object({ code: z.string(), display: z.string(), usedBy: z.object({ kind: z.string(), id: z.string(), name: z.string().nullable() }).nullable() })),
    }),
  }),
  defineEndpoint({
    name: "resolveCode",
    method: "GET",
    path: "/resolve",
    auth,
    description:
      "Resolves anything scanned: our label (bare, dashed, TT: prefixed or a /c/CODE deep link) → item/location, a free label → free_code, a manufacturer barcode/QR → items carrying it.",
    request: z.object({ code: z.string() }),
    response: z.object({
      raw: z.string(),
      code: z.string().nullable(),
      matches: z.array(
        z.union([
          z.object({ type: z.literal("item"), via: z.enum(["label", "barcode"]), item }),
          z.object({ type: z.literal("location"), location }),
          z.object({ type: z.literal("free_code"), code: z.string(), display: z.string(), inPool: z.boolean(), generatedAt: z.string().nullable() }),
        ]),
      ),
    }),
  }),

  // -------------------------------------------------------------------------
  // Dashboard, activity, images, CSV
  // -------------------------------------------------------------------------
  defineEndpoint({
    name: "stats",
    method: "GET",
    path: "/stats",
    auth,
    description: "Dashboard: totals, per-category counts/value, low stock, recently added, favorites, recent activity.",
    response: z.object({
      totals: z.object({ items: z.number(), units: z.number(), value: z.number(), low: z.number(), unplaced: z.number(), unlabeled: z.number(), locations: z.number() }),
      categories: z.array(z.object({ category: z.string(), n: z.number(), value: z.number() })),
      lowStock: z.array(item),
      recent: z.array(item),
      favorites: z.array(item),
      activity: z.array(activity),
    }),
  }),
  defineEndpoint({
    name: "listActivity",
    method: "GET",
    path: "/activity",
    auth,
    description: "Activity log, newest first; `before` = id cursor.",
    request: z.object({ target: z.string().optional(), limit: z.string().optional(), before: z.string().optional() }),
    response: z.object({ entries: z.array(activity) }),
  }),
  defineEndpoint({ name: "uploadImage", method: "POST", path: "/images", auth, description: "Raw image body (content-type image/*, ≤ 8 MB). Returns the id to put in imageIds/imageId.", response: z.object({ id: z.string() }) }),
  defineEndpoint({ name: "getImage", method: "GET", path: "/images/:id", auth, description: "Image bytes (immutable cache).", request: z.object({ id: z.string() }) }),
  defineEndpoint({ name: "exportCsv", method: "GET", path: "/export.csv", auth, description: "All items as CSV (location as 'A > B > C' path, specs as k=v; pairs)." }),
  defineEndpoint({
    name: "importCsv",
    method: "POST",
    path: "/import",
    auth,
    description: "Imports items from CSV (headers auto-mapped; missing location paths are created). dryRun validates only.",
    request: z.object({ csv: z.string(), dryRun: z.boolean().optional() }),
    response: z.object({ created: z.number(), errors: z.array(z.object({ row: z.number(), error: z.string() })), dryRun: z.boolean(), columns: z.array(z.string().nullable()) }),
  }),
];

export const manifest = defineAppManifest({
  name: "TwoThing",
  slug: "twothing",
  version: "0.2.0",
  shape: "backend+webapp",
  description:
    "Personal inventory: nested places (room › shelf › box), items with specs/images/stock levels, bulk-printed random QR label codes, and camera scanning for labels and manufacturer barcodes.",
  capabilities: [],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/twothing",
  endpoints,
});

export default manifest;
