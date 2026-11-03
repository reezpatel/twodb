import { sql } from "kysely";
import { db } from "../auth";
import type { NoteDatabaseSchema, NotePropertyDef } from "../plugins/db";
import { addPropertyColumn, ensureDatabaseTable, insertRowProps, notesTable, notesTableName, sqlIdent, updateRowProps } from "./notes-tables";
import { nextPosition } from "./notes-nodes";
import { getPrivateSetting, setPrivateSetting } from "./server-settings";
import { registerLockedDatabase, RowHookError, type HookContext, type LockedDatabaseHooks, type RowActor, type RowSnapshot } from "./locked-databases";
import { formatCode, generateCode, normalizeCode } from "./inventory-codes";
import { logger } from "./logger";

export const INVENTORY_ITEMS_LOCK = "twodb:inventory_items";
export const INVENTORY_LOCATIONS_LOCK = "twodb:inventory_locations";
export const INVENTORY_LOG_LOCK = "twodb:inventory_log";

export const ITEM_PROPS = {
  code: "code",
  description: "description",
  quantity: "quantity",
  unit: "unit",
  minQuantity: "min_quantity",
  location: "location",
  images: "images",
  groups: "groups",
  sku: "sku",
  extBarcode: "ext_barcode",
  supplier: "supplier",
  unitCost: "unit_cost",
  purchasedAt: "purchased_at",
  expiresAt: "expires_at",
  productUrl: "product_url",
} as const;

export const LOCATION_PROPS = {
  code: "code",
  kind: "kind",
  parent: "parent",
  path: "path",
  description: "description",
  images: "images",
} as const;

export const LOG_PROPS = {
  target: "target",
  targetKind: "target_kind",
  targetLabel: "target_label",
  action: "action",
  field: "field",
  fromValue: "from_value",
  toValue: "to_value",
  delta: "delta",
  actor: "actor",
  at: "at",
  reason: "reason",
} as const;

export const LOCATION_KINDS = ["warehouse", "room", "rack", "shelf", "box", "other"] as const;
export const LOG_ACTIONS = ["created", "updated", "quantity", "moved", "deleted", "restored", "imported"] as const;
export type LogAction = (typeof LOG_ACTIONS)[number];

const PATH_SEPARATOR = " › ";
const KIND_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#14b8a6", "#22c55e", "#64748b"];
const ACTION_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#64748b"];

function options(values: readonly string[], colors: string[]) {
  return values.map((value, i) => ({ id: `o_${value}`, value, label: value[0].toUpperCase() + value.slice(1), color: colors[i % colors.length] }));
}

export interface InventoryRecord {
  id: string;
  name: string;
  sectionId: string;
  items: string;
  locations: string;
  log: string;
}

const registryKey = (organizationId: string) => `inventories:${organizationId}`;

export async function listInventories(organizationId: string): Promise<InventoryRecord[]> {
  const stored = await getPrivateSetting<{ inventories?: InventoryRecord[] }>(registryKey(organizationId));
  return stored?.inventories ?? [];
}

export async function getInventory(organizationId: string, id: string): Promise<InventoryRecord | null> {
  return (await listInventories(organizationId)).find((i) => i.id === id) ?? null;
}

export async function inventoryOfDatabase(organizationId: string, databaseId: string): Promise<InventoryRecord | null> {
  return (await listInventories(organizationId)).find((i) => i.items === databaseId || i.locations === databaseId || i.log === databaseId) ?? null;
}

export function itemColumns(locationsDatabaseId: string): NotePropertyDef[] {
  return [
    { id: ITEM_PROPS.code, name: "Barcode", type: "id" },
    { id: ITEM_PROPS.description, name: "Description", type: "text" },
    { id: ITEM_PROPS.quantity, name: "Quantity", type: "number" },
    { id: ITEM_PROPS.unit, name: "Unit", type: "select", options: [] },
    { id: ITEM_PROPS.minQuantity, name: "Min stock", type: "number" },
    { id: ITEM_PROPS.location, name: "Location", type: "relation", relation: { databaseId: locationsDatabaseId } },
    { id: ITEM_PROPS.images, name: "Images", type: "media" },
    { id: ITEM_PROPS.groups, name: "Groups", type: "multiselect", options: [] },
    { id: ITEM_PROPS.sku, name: "SKU", type: "text" },
    { id: ITEM_PROPS.extBarcode, name: "Manufacturer barcode", type: "text" },
    { id: ITEM_PROPS.supplier, name: "Supplier", type: "text" },
    { id: ITEM_PROPS.unitCost, name: "Unit cost", type: "number" },
    { id: ITEM_PROPS.purchasedAt, name: "Purchased", type: "date" },
    { id: ITEM_PROPS.expiresAt, name: "Expiry / warranty", type: "date" },
    { id: ITEM_PROPS.productUrl, name: "Link", type: "url" },
  ];
}

export function locationColumns(locationsDatabaseId: string): NotePropertyDef[] {
  return [
    { id: LOCATION_PROPS.code, name: "Barcode", type: "id" },
    { id: LOCATION_PROPS.kind, name: "Type", type: "select", options: options(LOCATION_KINDS, KIND_COLORS) },
    { id: LOCATION_PROPS.parent, name: "Parent", type: "relation", relation: { databaseId: locationsDatabaseId } },
    { id: LOCATION_PROPS.path, name: "Path", type: "text" },
    { id: LOCATION_PROPS.description, name: "Description", type: "text" },
    { id: LOCATION_PROPS.images, name: "Images", type: "media" },
  ];
}

export function logColumns(): NotePropertyDef[] {
  return [
    { id: LOG_PROPS.target, name: "Target", type: "text" },
    { id: LOG_PROPS.targetKind, name: "Target type", type: "select", options: options(["item", "location"], ["#3b82f6", "#f59e0b"]) },
    { id: LOG_PROPS.targetLabel, name: "Target label", type: "text" },
    { id: LOG_PROPS.action, name: "Action", type: "select", options: options(LOG_ACTIONS, ACTION_COLORS) },
    { id: LOG_PROPS.field, name: "Field", type: "text" },
    { id: LOG_PROPS.fromValue, name: "From", type: "text" },
    { id: LOG_PROPS.toValue, name: "To", type: "text" },
    { id: LOG_PROPS.delta, name: "Delta", type: "number" },
    { id: LOG_PROPS.actor, name: "Actor", type: "person" },
    { id: LOG_PROPS.at, name: "At", type: "date" },
    { id: LOG_PROPS.reason, name: "Reason", type: "text" },
  ];
}

function tableSchema(columns: NotePropertyDef[], kanbanBy?: string): NoteDatabaseSchema {
  return {
    columns,
    views: [
      { id: crypto.randomUUID(), name: "Table", type: "table" },
      { id: crypto.randomUUID(), name: "List", type: "list" },
      ...(kanbanBy ? [{ id: crypto.randomUUID(), name: "Board", type: "kanban" as const, groupBy: kanbanBy }] : []),
    ],
  };
}

async function createLockedDatabase(input: {
  id: string;
  organizationId: string;
  parentId: string;
  title: string;
  lock: string;
  schema: NoteDatabaseSchema;
  uniqueColumns?: string[];
}) {
  const now = new Date();
  await db
    .insertInto("note_node")
    .values({
      id: input.id,
      organizationId: input.organizationId,
      parentId: input.parentId,
      kind: "database",
      title: input.title.slice(0, 200),
      schema: input.schema,
      schemaLockedBy: input.lock,
      position: await nextPosition(input.organizationId, input.parentId),
      createdAt: now,
      updatedAt: now,
    })
    .execute();
  await ensureDatabaseTable(db, input.id);
  for (const col of input.schema.columns) await addPropertyColumn(db, input.id, col.id, col.type);
  for (const col of input.uniqueColumns ?? []) {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS ${sqlIdent(`uq_${notesTableName(input.id)}_${col}`)} ON ${notesTable(input.id)} (${sqlIdent(col)})`.execute(db);
  }
}

/** One inventory = a section holding three locked databases: items,
 *  locations and an audit log. */
export async function createInventory(organizationId: string, name: string): Promise<InventoryRecord> {
  const title = name.trim().slice(0, 200) || "Inventory";
  const now = new Date();
  const sectionId = crypto.randomUUID();
  await db
    .insertInto("note_node")
    .values({
      id: sectionId,
      organizationId,
      parentId: null,
      kind: "section",
      title,
      position: await nextPosition(organizationId, null),
      createdAt: now,
      updatedAt: now,
    })
    .execute();

  const record: InventoryRecord = { id: crypto.randomUUID(), name: title, sectionId, items: crypto.randomUUID(), locations: crypto.randomUUID(), log: crypto.randomUUID() };
  await createLockedDatabase({
    id: record.locations,
    organizationId,
    parentId: sectionId,
    title: "Locations",
    lock: INVENTORY_LOCATIONS_LOCK,
    schema: tableSchema(locationColumns(record.locations), LOCATION_PROPS.kind),
    uniqueColumns: [LOCATION_PROPS.code],
  });
  await createLockedDatabase({
    id: record.items,
    organizationId,
    parentId: sectionId,
    title: "Items",
    lock: INVENTORY_ITEMS_LOCK,
    schema: tableSchema(itemColumns(record.locations)),
    uniqueColumns: [ITEM_PROPS.code],
  });
  await createLockedDatabase({
    id: record.log,
    organizationId,
    parentId: sectionId,
    title: "Log",
    lock: INVENTORY_LOG_LOCK,
    schema: tableSchema(logColumns()),
  });

  await setPrivateSetting(registryKey(organizationId), { inventories: [...(await listInventories(organizationId)), record] });
  return record;
}

type RawRow = Record<string, unknown>;

const liveJoin = (organizationId: string) => sql`JOIN note_node n ON n.id = t."noteId" AND n."deletedAt" IS NULL AND n."organizationId" = ${organizationId}`;

async function queryRows(organizationId: string, databaseId: string, where = sql`TRUE`): Promise<RawRow[]> {
  const res = await sql<RawRow>`
    SELECT t.*, n.title FROM ${notesTable(databaseId)} t ${liveJoin(organizationId)}
    WHERE ${where} ORDER BY n."createdAt" ASC
  `.execute(db);
  return res.rows;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const strArray = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : []);

export interface LocationView {
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

export interface ItemView {
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

function itemView(r: RawRow, locations: Map<string, LocationView>): ItemView {
  const locationId = (r[ITEM_PROPS.location] as string | null) ?? null;
  const quantity = Number(r[ITEM_PROPS.quantity] ?? 0);
  const minQuantity = num(r[ITEM_PROPS.minQuantity]);
  return {
    id: String(r.noteId),
    title: String(r.title ?? ""),
    code: (r[ITEM_PROPS.code] as string | null) ?? null,
    description: (r[ITEM_PROPS.description] as string | null) ?? null,
    quantity,
    unit: (r[ITEM_PROPS.unit] as string | null) ?? null,
    minQuantity,
    lowStock: minQuantity !== null && quantity <= minQuantity,
    locationId,
    locationPath: locationId ? (locations.get(locationId)?.path ?? null) : null,
    images: strArray(r[ITEM_PROPS.images]),
    groups: strArray(r[ITEM_PROPS.groups]),
    sku: (r[ITEM_PROPS.sku] as string | null) ?? null,
    extBarcode: (r[ITEM_PROPS.extBarcode] as string | null) ?? null,
    supplier: (r[ITEM_PROPS.supplier] as string | null) ?? null,
    unitCost: num(r[ITEM_PROPS.unitCost]),
    purchasedAt: iso(r[ITEM_PROPS.purchasedAt]),
    expiresAt: iso(r[ITEM_PROPS.expiresAt]),
    productUrl: (r[ITEM_PROPS.productUrl] as string | null) ?? null,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

/** All live locations with direct + recursive item counts. */
export async function loadLocations(organizationId: string, inv: InventoryRecord): Promise<Map<string, LocationView>> {
  const [rows, counts] = await Promise.all([
    queryRows(organizationId, inv.locations),
    sql<{ location: string; count: string }>`
      SELECT t."location", count(*) AS count FROM ${notesTable(inv.items)} t ${liveJoin(organizationId)}
      WHERE t."location" IS NOT NULL GROUP BY t."location"
    `.execute(db),
  ]);
  const direct = new Map(counts.rows.map((r) => [r.location, Number(r.count)]));
  const map = new Map<string, LocationView>();
  for (const r of rows) {
    const id = String(r.noteId);
    map.set(id, {
      id,
      title: String(r.title ?? ""),
      code: (r[LOCATION_PROPS.code] as string | null) ?? null,
      kind: (r[LOCATION_PROPS.kind] as string | null) ?? null,
      parentId: (r[LOCATION_PROPS.parent] as string | null) ?? null,
      path: (r[LOCATION_PROPS.path] as string | null) || String(r.title ?? ""),
      description: (r[LOCATION_PROPS.description] as string | null) ?? null,
      images: strArray(r[LOCATION_PROPS.images]),
      itemCount: direct.get(id) ?? 0,
      totalItems: 0,
      childCount: 0,
    });
  }
  for (const loc of map.values()) {
    if (loc.parentId) {
      const parent = map.get(loc.parentId);
      if (parent) parent.childCount++;
    }
    const seen = new Set<string>();
    for (let cur: LocationView | undefined = loc; cur && !seen.has(cur.id); cur = cur.parentId ? map.get(cur.parentId) : undefined) {
      seen.add(cur.id);
      cur.totalItems += loc.itemCount;
    }
  }
  return map;
}

export function descendantIds(locations: Map<string, LocationView>, rootId: string): string[] {
  const out = [rootId];
  for (let i = 0; i < out.length; i++) {
    for (const loc of locations.values()) if (loc.parentId === out[i] && !out.includes(loc.id)) out.push(loc.id);
  }
  return out;
}

export function breadcrumb(locations: Map<string, LocationView>, locationId: string | null) {
  const chain: { id: string; title: string; code: string | null; kind: string | null }[] = [];
  const seen = new Set<string>();
  for (let cur = locationId ? locations.get(locationId) : undefined; cur && !seen.has(cur.id); cur = cur.parentId ? locations.get(cur.parentId) : undefined) {
    seen.add(cur.id);
    chain.unshift({ id: cur.id, title: cur.title, code: cur.code, kind: cur.kind });
  }
  return chain;
}

export interface ItemFilters {
  q?: string;
  group?: string;
  location?: string;
  recursive?: boolean;
  low?: boolean;
  unplaced?: boolean;
}

export async function listItems(organizationId: string, inv: InventoryRecord, filters: ItemFilters = {}): Promise<ItemView[]> {
  const [rows, locations] = await Promise.all([queryRows(organizationId, inv.items), loadLocations(organizationId, inv)]);
  let items = rows.map((r) => itemView(r, locations));
  if (filters.location) {
    const ids = new Set(filters.recursive === false ? [filters.location] : descendantIds(locations, filters.location));
    items = items.filter((i) => i.locationId && ids.has(i.locationId));
  }
  if (filters.unplaced) items = items.filter((i) => !i.locationId);
  if (filters.group) items = items.filter((i) => i.groups.includes(filters.group!));
  if (filters.low) items = items.filter((i) => i.lowStock);
  const q = filters.q?.trim().toLowerCase();
  if (q) {
    const code = normalizeCode(q);
    items = items.filter((i) =>
      [i.title, i.code, i.sku, i.extBarcode, i.description, i.supplier, i.locationPath, ...i.groups].some((v) => v?.toLowerCase().includes(q)) || (code !== null && i.code === code),
    );
  }
  return items.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

export async function getItem(organizationId: string, inv: InventoryRecord, itemId: string): Promise<ItemView | null> {
  const [rows, locations] = await Promise.all([queryRows(organizationId, inv.items, sql`t."noteId" = ${itemId}`), loadLocations(organizationId, inv)]);
  return rows[0] ? itemView(rows[0], locations) : null;
}

export async function listGroups(organizationId: string, inv: InventoryRecord) {
  const res = await sql<{ name: string; count: string }>`
    SELECT g AS name, count(*) AS count FROM ${notesTable(inv.items)} t ${liveJoin(organizationId)}
    CROSS JOIN LATERAL unnest(t."groups") AS g GROUP BY g ORDER BY g
  `.execute(db);
  return res.rows.map((r) => ({ name: r.name, count: Number(r.count) }));
}

export async function inventorySummary(organizationId: string, inv: InventoryRecord) {
  const res = await sql<Record<string, string | null>>`
    SELECT count(*) AS items,
      COALESCE(sum(COALESCE(t."quantity", 0)), 0) AS quantity,
      COALESCE(sum(COALESCE(t."quantity", 0) * COALESCE(t."unit_cost", 0)), 0) AS value,
      count(*) FILTER (WHERE t."min_quantity" IS NOT NULL AND COALESCE(t."quantity", 0) <= t."min_quantity") AS low,
      count(*) FILTER (WHERE t."location" IS NULL) AS unplaced,
      count(*) FILTER (WHERE t."expires_at" IS NOT NULL AND t."expires_at" < now() + interval '30 days') AS expiring
    FROM ${notesTable(inv.items)} t ${liveJoin(organizationId)}
  `.execute(db);
  const locations = await sql<{ count: string }>`SELECT count(*) AS count FROM ${notesTable(inv.locations)} t ${liveJoin(organizationId)}`.execute(db);
  const row = res.rows[0] ?? {};
  return {
    items: Number(row.items ?? 0),
    quantity: Number(row.quantity ?? 0),
    value: Number(row.value ?? 0),
    lowStock: Number(row.low ?? 0),
    unplaced: Number(row.unplaced ?? 0),
    expiring: Number(row.expiring ?? 0),
    locations: Number(locations.rows[0]?.count ?? 0),
  };
}

export type ResolveMatch =
  | { kind: "item"; id: string; databaseId: string; item: ItemView; breadcrumb: ReturnType<typeof breadcrumb> }
  | { kind: "location"; id: string; databaseId: string; location: LocationView; breadcrumb: ReturnType<typeof breadcrumb> };

/** Scan lookup: own barcodes first (items, then locations), then the
 *  manufacturer barcode / SKU of items. */
export async function resolveCode(organizationId: string, inv: InventoryRecord, raw: string): Promise<ResolveMatch[]> {
  const text = raw.trim();
  if (!text) return [];
  const locations = await loadLocations(organizationId, inv);
  const code = normalizeCode(text);
  const matches: ResolveMatch[] = [];
  if (code) {
    const items = await queryRows(organizationId, inv.items, sql`t."code" = ${code}`);
    for (const r of items) {
      const item = itemView(r, locations);
      matches.push({ kind: "item", id: item.id, databaseId: inv.items, item, breadcrumb: breadcrumb(locations, item.locationId) });
    }
    const loc = [...locations.values()].find((l) => l.code === code);
    if (loc) matches.push({ kind: "location", id: loc.id, databaseId: inv.locations, location: loc, breadcrumb: breadcrumb(locations, loc.id) });
    if (matches.length > 0) return matches;
  }
  const external = await queryRows(organizationId, inv.items, sql`t."ext_barcode" = ${text} OR lower(t."sku") = ${text.toLowerCase()}`);
  for (const r of external) {
    const item = itemView(r, locations);
    matches.push({ kind: "item", id: item.id, databaseId: inv.items, item, breadcrumb: breadcrumb(locations, item.locationId) });
  }
  return matches;
}

const codeTaken = async (inv: InventoryRecord, code: string) => {
  const res = await sql<{ n: number }>`
    SELECT 1 AS n FROM ${notesTable(inv.items)} WHERE "code" = ${code}
    UNION ALL SELECT 1 FROM ${notesTable(inv.locations)} WHERE "code" = ${code} LIMIT 1
  `.execute(db);
  return res.rows.length > 0;
};

async function allocateCode(inv: InventoryRecord, wanted: unknown): Promise<string> {
  if (typeof wanted === "string" && wanted.trim() !== "") {
    const code = normalizeCode(wanted);
    if (!code) throw new RowHookError("invalid_code", 400);
    if (await codeTaken(inv, code)) throw new RowHookError("code_taken", 409, code);
    return code;
  }
  for (let i = 0; i < 12; i++) {
    const code = generateCode();
    if (!(await codeTaken(inv, code))) return code;
  }
  throw new RowHookError("code_generation_failed", 409);
}

async function requireInventory(ctx: HookContext): Promise<InventoryRecord> {
  const inv = await inventoryOfDatabase(ctx.organizationId, ctx.database.id);
  if (!inv) throw new RowHookError("inventory_not_found", 404);
  return inv;
}

const asNumber = (v: unknown, key: string, min = 0): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < min) throw new RowHookError(`invalid_value:${key}`, 400);
  return v;
};

async function requireLiveLocation(ctx: Pick<HookContext, "organizationId">, inv: InventoryRecord, id: unknown, key: string): Promise<string | null> {
  if (id === null || id === undefined || id === "") return null;
  if (typeof id !== "string") throw new RowHookError(`invalid_value:${key}`, 400);
  const row = await db
    .selectFrom("note_node")
    .select("id")
    .where("id", "=", id)
    .where("organizationId", "=", ctx.organizationId)
    .where("parentId", "=", inv.locations)
    .where("deletedAt", "is", null)
    .executeTakeFirst();
  if (!row) throw new RowHookError(`invalid_location:${key}`, 400);
  return id;
}

function normalizeValue(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (v === null || v === undefined) return "";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

function displayValue(field: string, v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return field === ITEM_PROPS.images ? `${v.length} image${v.length === 1 ? "" : "s"}` : v.join(", ");
  return String(v).slice(0, 500);
}

export interface LogEntryInput {
  target: string;
  targetKind: "item" | "location";
  targetLabel: string;
  action: LogAction;
  title: string;
  field?: string | null;
  from?: string | null;
  to?: string | null;
  delta?: number | null;
  actor?: RowActor | null;
  reason?: string | null;
}

export async function writeLog(organizationId: string, inv: InventoryRecord, e: LogEntryInput): Promise<void> {
  try {
    const now = new Date();
    const noteId = crypto.randomUUID();
    await db
      .insertInto("note_node")
      .values({
        id: noteId,
        organizationId,
        parentId: inv.log,
        kind: "page",
        title: e.title.slice(0, 200),
        content: { doc: { type: "doc", content: [] } },
        createdAt: now,
        updatedAt: now,
      })
      .execute();
    await insertRowProps(db, inv.log, noteId, {
      [LOG_PROPS.target]: e.target,
      [LOG_PROPS.targetKind]: e.targetKind,
      [LOG_PROPS.targetLabel]: e.targetLabel.slice(0, 300),
      [LOG_PROPS.action]: e.action,
      [LOG_PROPS.field]: e.field ?? null,
      [LOG_PROPS.fromValue]: e.from ?? null,
      [LOG_PROPS.toValue]: e.to ?? null,
      [LOG_PROPS.delta]: e.delta ?? null,
      [LOG_PROPS.actor]: e.actor?.name ?? null,
      [LOG_PROPS.at]: now,
      [LOG_PROPS.reason]: e.reason ?? null,
    });
  } catch (err) {
    logger.warn({ err, target: e.target }, "inventory: log write failed");
  }
}

const label = (title: string, code: unknown) => `${title || "Untitled"}${typeof code === "string" && code ? ` (${formatCode(code)})` : ""}`;

async function locationPathOf(inv: InventoryRecord, id: unknown): Promise<string> {
  if (typeof id !== "string" || !id) return "";
  const res = await sql<{ path: string | null }>`SELECT "path" FROM ${notesTable(inv.locations)} WHERE "noteId" = ${id}`.execute(db);
  return res.rows[0]?.path ?? "";
}

/** Field-by-field audit entries for a generic row edit. */
async function logDiff(ctx: HookContext, inv: InventoryRecord, kind: "item" | "location", prev: RowSnapshot, next: RowSnapshot) {
  const target = next.noteId;
  const targetLabel = label(next.title, next.props[ITEM_PROPS.code]);
  const base = { target, targetKind: kind, targetLabel, actor: ctx.actor } as const;
  if (prev.title !== next.title) {
    await writeLog(ctx.organizationId, inv, { ...base, action: "updated", title: `Renamed: ${prev.title || "Untitled"} → ${next.title || "Untitled"}`, field: "title", from: prev.title, to: next.title });
  }
  for (const key of Object.keys(next.props)) {
    if (key === ITEM_PROPS.code || key === LOCATION_PROPS.path) continue;
    const a = prev.props[key];
    const b = next.props[key];
    if (normalizeValue(a) === normalizeValue(b)) continue;
    if (kind === "item" && key === ITEM_PROPS.quantity) {
      const before = Number(a ?? 0);
      const after = Number(b ?? 0);
      await writeLog(ctx.organizationId, inv, { ...base, action: "quantity", title: `Quantity ${before} → ${after}`, field: key, from: String(before), to: String(after), delta: after - before });
    } else if (key === ITEM_PROPS.location || (kind === "location" && key === LOCATION_PROPS.parent)) {
      const from = await locationPathOf(inv, a);
      const to = await locationPathOf(inv, b);
      await writeLog(ctx.organizationId, inv, { ...base, action: "moved", title: `Moved: ${from || "—"} → ${to || "—"}`, field: key, from, to });
    } else {
      await writeLog(ctx.organizationId, inv, { ...base, action: "updated", title: `Changed ${key}`, field: key, from: displayValue(key, a), to: displayValue(key, b) });
    }
  }
}

const itemHooks: LockedDatabaseHooks = {
  async beforeInsert(ctx, draft) {
    const inv = await requireInventory(ctx);
    const props = draft.props;
    return {
      props: {
        [ITEM_PROPS.code]: await allocateCode(inv, props[ITEM_PROPS.code]),
        [ITEM_PROPS.quantity]: asNumber(props[ITEM_PROPS.quantity], ITEM_PROPS.quantity) ?? 0,
        [ITEM_PROPS.minQuantity]: asNumber(props[ITEM_PROPS.minQuantity], ITEM_PROPS.minQuantity),
        [ITEM_PROPS.unitCost]: asNumber(props[ITEM_PROPS.unitCost], ITEM_PROPS.unitCost),
        [ITEM_PROPS.location]: await requireLiveLocation(ctx, inv, props[ITEM_PROPS.location], ITEM_PROPS.location),
      },
    };
  },
  async afterInsert(ctx, row) {
    const inv = await requireInventory(ctx);
    await writeLog(ctx.organizationId, inv, {
      target: row.noteId,
      targetKind: "item",
      targetLabel: label(row.title, row.props[ITEM_PROPS.code]),
      action: "created",
      title: `Created ${row.title || "Untitled"}`,
      actor: ctx.actor,
    });
  },
  async beforeUpdate(ctx, prev, patch) {
    const inv = await requireInventory(ctx);
    const p = patch.props;
    const out: Record<string, unknown> = {};
    if (ITEM_PROPS.code in p && p[ITEM_PROPS.code] !== prev.props[ITEM_PROPS.code]) throw new RowHookError("code_immutable", 403);
    if (ITEM_PROPS.quantity in p) out[ITEM_PROPS.quantity] = asNumber(p[ITEM_PROPS.quantity], ITEM_PROPS.quantity) ?? 0;
    if (ITEM_PROPS.minQuantity in p) out[ITEM_PROPS.minQuantity] = asNumber(p[ITEM_PROPS.minQuantity], ITEM_PROPS.minQuantity);
    if (ITEM_PROPS.unitCost in p) out[ITEM_PROPS.unitCost] = asNumber(p[ITEM_PROPS.unitCost], ITEM_PROPS.unitCost);
    if (ITEM_PROPS.location in p) out[ITEM_PROPS.location] = await requireLiveLocation(ctx, inv, p[ITEM_PROPS.location], ITEM_PROPS.location);
    return { props: out };
  },
  async afterUpdate(ctx, prev, next) {
    await logDiff(ctx, await requireInventory(ctx), "item", prev, next);
  },
  async afterDelete(ctx, row) {
    await writeLog(ctx.organizationId, await requireInventory(ctx), {
      target: row.noteId,
      targetKind: "item",
      targetLabel: label(row.title, row.props[ITEM_PROPS.code]),
      action: "deleted",
      title: `Deleted ${row.title || "Untitled"}`,
      actor: ctx.actor,
    });
  },
  async afterRestore(ctx, row) {
    await writeLog(ctx.organizationId, await requireInventory(ctx), {
      target: row.noteId,
      targetKind: "item",
      targetLabel: label(row.title, row.props[ITEM_PROPS.code]),
      action: "restored",
      title: `Restored ${row.title || "Untitled"}`,
      actor: ctx.actor,
    });
  },
};

async function parentPathOf(inv: InventoryRecord, parentId: string | null): Promise<string> {
  return parentId ? await locationPathOf(inv, parentId) : "";
}

const joinPath = (parentPath: string, title: string) => (parentPath ? `${parentPath}${PATH_SEPARATOR}` : "") + (title.trim() || "Untitled");

/** Walks up from `startId`; true when `targetId` is on the way (cycle). */
async function isAncestorOrSelf(inv: InventoryRecord, targetId: string, startId: string): Promise<boolean> {
  let cur: string | null = startId;
  for (let depth = 0; cur && depth < 64; depth++) {
    if (cur === targetId) return true;
    const res: { rows: { parent: string | null }[] } = await sql<{ parent: string | null }>`SELECT "parent" FROM ${notesTable(inv.locations)} WHERE "noteId" = ${cur}`.execute(db);
    cur = res.rows[0]?.parent ?? null;
  }
  return false;
}

export async function rebuildPaths(organizationId: string, inv: InventoryRecord, rootId: string) {
  const queue = [rootId];
  for (let i = 0; i < queue.length && i < 5000; i++) {
    const parentPath = await locationPathOf(inv, queue[i]);
    const children = await sql<{ noteId: string; title: string }>`
      SELECT t."noteId", n.title FROM ${notesTable(inv.locations)} t
      JOIN note_node n ON n.id = t."noteId" AND n."organizationId" = ${organizationId}
      WHERE t."parent" = ${queue[i]}
    `.execute(db);
    for (const child of children.rows) {
      await updateRowProps(db, inv.locations, child.noteId, { [LOCATION_PROPS.path]: joinPath(parentPath, child.title) });
      queue.push(child.noteId);
    }
  }
}

const locationHooks: LockedDatabaseHooks = {
  async beforeInsert(ctx, draft) {
    const inv = await requireInventory(ctx);
    const parent = await requireLiveLocation(ctx, inv, draft.props[LOCATION_PROPS.parent], LOCATION_PROPS.parent);
    return {
      props: {
        [LOCATION_PROPS.code]: await allocateCode(inv, draft.props[LOCATION_PROPS.code]),
        [LOCATION_PROPS.parent]: parent,
        [LOCATION_PROPS.path]: joinPath(await parentPathOf(inv, parent), draft.title),
      },
    };
  },
  async afterInsert(ctx, row) {
    await writeLog(ctx.organizationId, await requireInventory(ctx), {
      target: row.noteId,
      targetKind: "location",
      targetLabel: label(row.title, row.props[LOCATION_PROPS.code]),
      action: "created",
      title: `Created ${row.title || "Untitled"}`,
      actor: ctx.actor,
    });
  },
  async beforeUpdate(ctx, prev, patch) {
    const inv = await requireInventory(ctx);
    const p = patch.props;
    if (LOCATION_PROPS.code in p && p[LOCATION_PROPS.code] !== prev.props[LOCATION_PROPS.code]) throw new RowHookError("code_immutable", 403);
    let parent = (prev.props[LOCATION_PROPS.parent] as string | null) ?? null;
    const out: Record<string, unknown> = {};
    if (LOCATION_PROPS.parent in p) {
      parent = await requireLiveLocation(ctx, inv, p[LOCATION_PROPS.parent], LOCATION_PROPS.parent);
      if (parent && (await isAncestorOrSelf(inv, prev.noteId, parent))) throw new RowHookError("location_cycle", 400);
      out[LOCATION_PROPS.parent] = parent;
    }
    out[LOCATION_PROPS.path] = joinPath(await parentPathOf(inv, parent), patch.title ?? prev.title);
    return { props: out };
  },
  async afterUpdate(ctx, prev, next) {
    const inv = await requireInventory(ctx);
    if (prev.props[LOCATION_PROPS.path] !== next.props[LOCATION_PROPS.path]) await rebuildPaths(ctx.organizationId, inv, next.noteId);
    await logDiff(ctx, inv, "location", prev, next);
  },
  async beforeDelete(ctx, row) {
    const inv = await requireInventory(ctx);
    const [children, items] = await Promise.all([
      sql<{ n: string }>`SELECT count(*) AS n FROM ${notesTable(inv.locations)} t ${liveJoin(ctx.organizationId)} WHERE t."parent" = ${row.noteId}`.execute(db),
      sql<{ n: string }>`SELECT count(*) AS n FROM ${notesTable(inv.items)} t ${liveJoin(ctx.organizationId)} WHERE t."location" = ${row.noteId}`.execute(db),
    ]);
    const c = Number(children.rows[0]?.n ?? 0);
    const i = Number(items.rows[0]?.n ?? 0);
    if (c > 0 || i > 0) throw new RowHookError("location_not_empty", 409, `${i} item(s), ${c} sub-location(s)`);
  },
  async afterDelete(ctx, row) {
    await writeLog(ctx.organizationId, await requireInventory(ctx), {
      target: row.noteId,
      targetKind: "location",
      targetLabel: label(row.title, row.props[LOCATION_PROPS.code]),
      action: "deleted",
      title: `Deleted ${row.title || "Untitled"}`,
      actor: ctx.actor,
    });
  },
  async afterRestore(ctx, row) {
    await writeLog(ctx.organizationId, await requireInventory(ctx), {
      target: row.noteId,
      targetKind: "location",
      targetLabel: label(row.title, row.props[LOCATION_PROPS.code]),
      action: "restored",
      title: `Restored ${row.title || "Untitled"}`,
      actor: ctx.actor,
    });
  },
};

registerLockedDatabase(INVENTORY_ITEMS_LOCK, itemHooks);
registerLockedDatabase(INVENTORY_LOCATIONS_LOCK, locationHooks);
registerLockedDatabase(INVENTORY_LOG_LOCK, { rowsReadOnly: true });

/** Insert an item/location through the same hooks the generic routes use. */
async function insertRow(
  hooks: LockedDatabaseHooks,
  organizationId: string,
  inv: InventoryRecord,
  databaseId: string,
  draft: { title: string; props: Record<string, unknown> },
  actor: RowActor,
  imported = false,
): Promise<string> {
  const database = await db.selectFrom("note_node").selectAll().where("id", "=", databaseId).executeTakeFirstOrThrow();
  const ctx: HookContext = { organizationId, database, actor };
  const out = await hooks.beforeInsert!(ctx, draft);
  const props = { ...draft.props, ...out?.props };
  const now = new Date();
  const noteId = crypto.randomUUID();
  await db
    .insertInto("note_node")
    .values({
      id: noteId,
      organizationId,
      parentId: databaseId,
      kind: "page",
      title: (out?.title ?? draft.title).slice(0, 200),
      content: { doc: { type: "doc", content: [] } },
      preview: typeof props[ITEM_PROPS.description] === "string" ? (props[ITEM_PROPS.description] as string).slice(0, 200) : "",
      position: await nextPosition(organizationId, databaseId),
      createdAt: now,
      updatedAt: now,
    })
    .execute();
  await insertRowProps(db, databaseId, noteId, props);
  const title = out?.title ?? draft.title;
  if (imported) {
    await writeLog(organizationId, inv, {
      target: noteId,
      targetKind: databaseId === inv.items ? "item" : "location",
      targetLabel: label(title, props[ITEM_PROPS.code]),
      action: "imported",
      title: `Imported ${title || "Untitled"}`,
      actor,
    });
  } else {
    await hooks.afterInsert?.(ctx, { noteId, title, props });
  }
  return noteId;
}

export const insertItem = (organizationId: string, inv: InventoryRecord, draft: { title: string; props: Record<string, unknown> }, actor: RowActor, imported = false) =>
  insertRow(itemHooks, organizationId, inv, inv.items, draft, actor, imported);

export const insertLocation = (organizationId: string, inv: InventoryRecord, draft: { title: string; props: Record<string, unknown> }, actor: RowActor) =>
  insertRow(locationHooks, organizationId, inv, inv.locations, draft, actor);

async function itemSnapshot(organizationId: string, inv: InventoryRecord, itemId: string) {
  const rows = await queryRows(organizationId, inv.items, sql`t."noteId" = ${itemId}`);
  return rows[0] ?? null;
}

export async function adjustQuantity(
  organizationId: string,
  inv: InventoryRecord,
  itemId: string,
  op: { delta?: unknown; set?: unknown; reason?: unknown },
  actor: RowActor,
) {
  const item = await itemSnapshot(organizationId, inv, itemId);
  if (!item) throw new RowHookError("item_not_found", 404);
  const table = notesTable(inv.items);
  let before: number;
  let after: number;
  if (op.set !== undefined) {
    if (typeof op.set !== "number" || !Number.isFinite(op.set) || op.set < 0) throw new RowHookError("invalid_quantity", 400);
    const res = await sql<{ before: number | null; after: number }>`
      WITH old AS (SELECT "quantity" FROM ${table} WHERE "noteId" = ${itemId} FOR UPDATE)
      UPDATE ${table} AS t SET "quantity" = ${op.set}::double precision, "updatedAt" = now()
      FROM old WHERE t."noteId" = ${itemId}
      RETURNING old."quantity" AS before, t."quantity" AS after
    `.execute(db);
    before = Number(res.rows[0]?.before ?? 0);
    after = Number(res.rows[0]?.after ?? op.set);
  } else {
    if (typeof op.delta !== "number" || !Number.isFinite(op.delta) || op.delta === 0) throw new RowHookError("invalid_delta", 400);
    const res = await sql<{ after: number }>`
      UPDATE ${table} AS t SET "quantity" = COALESCE(t."quantity", 0) + ${op.delta}::double precision, "updatedAt" = now()
      WHERE t."noteId" = ${itemId} AND COALESCE(t."quantity", 0) + ${op.delta}::double precision >= 0
      RETURNING t."quantity" AS after
    `.execute(db);
    if (res.rows.length === 0) throw new RowHookError("insufficient_stock", 409, String(item[ITEM_PROPS.quantity] ?? 0));
    after = Number(res.rows[0].after);
    before = after - op.delta;
  }
  await db.updateTable("note_node").set({ updatedAt: new Date() }).where("id", "=", itemId).execute();
  const delta = after - before;
  if (delta !== 0) {
    await writeLog(organizationId, inv, {
      target: itemId,
      targetKind: "item",
      targetLabel: label(String(item.title ?? ""), item[ITEM_PROPS.code]),
      action: "quantity",
      title: `Quantity ${before} → ${after}`,
      field: ITEM_PROPS.quantity,
      from: String(before),
      to: String(after),
      delta,
      actor,
      reason: typeof op.reason === "string" && op.reason.trim() ? op.reason.trim().slice(0, 500) : null,
    });
  }
  return { quantity: after, previous: before };
}

export async function moveItem(organizationId: string, inv: InventoryRecord, itemId: string, locationId: unknown, reasonRaw: unknown, actor: RowActor) {
  const item = await itemSnapshot(organizationId, inv, itemId);
  if (!item) throw new RowHookError("item_not_found", 404);
  const target = await requireLiveLocation({ organizationId }, inv, locationId, "location");
  const previous = (item[ITEM_PROPS.location] as string | null) ?? null;
  if (previous === target) return { locationId: target, locationPath: await locationPathOf(inv, target) || null };
  await updateRowProps(db, inv.items, itemId, { [ITEM_PROPS.location]: target });
  await db.updateTable("note_node").set({ updatedAt: new Date() }).where("id", "=", itemId).execute();
  const from = await locationPathOf(inv, previous);
  const to = await locationPathOf(inv, target);
  await writeLog(organizationId, inv, {
    target: itemId,
    targetKind: "item",
    targetLabel: label(String(item.title ?? ""), item[ITEM_PROPS.code]),
    action: "moved",
    title: `Moved: ${from || "—"} → ${to || "—"}`,
    field: ITEM_PROPS.location,
    from,
    to,
    actor,
    reason: typeof reasonRaw === "string" && reasonRaw.trim() ? reasonRaw.trim().slice(0, 500) : null,
  });
  return { locationId: target, locationPath: to || null };
}

export async function readLog(organizationId: string, inv: InventoryRecord, opts: { target?: string; limit?: number; offset?: number }) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const res = await sql<RawRow>`
    SELECT t.*, n.title FROM ${notesTable(inv.log)} t ${liveJoin(organizationId)}
    WHERE ${opts.target ? sql`t."target" = ${opts.target}` : sql`TRUE`}
    ORDER BY t."at" DESC NULLS LAST, n."createdAt" DESC LIMIT ${limit} OFFSET ${Math.max(opts.offset ?? 0, 0)}
  `.execute(db);
  return res.rows.map((r) => ({
    id: String(r.noteId),
    title: String(r.title ?? ""),
    target: r[LOG_PROPS.target] as string | null,
    targetKind: r[LOG_PROPS.targetKind] as string | null,
    targetLabel: r[LOG_PROPS.targetLabel] as string | null,
    action: r[LOG_PROPS.action] as string | null,
    field: r[LOG_PROPS.field] as string | null,
    from: r[LOG_PROPS.fromValue] as string | null,
    to: r[LOG_PROPS.toValue] as string | null,
    delta: num(r[LOG_PROPS.delta]),
    actor: r[LOG_PROPS.actor] as string | null,
    at: iso(r[LOG_PROPS.at]),
    reason: r[LOG_PROPS.reason] as string | null,
  }));
}

export async function labelData(organizationId: string, inv: InventoryRecord, kind: "item" | "location", ids?: string[]) {
  const locations = await loadLocations(organizationId, inv);
  if (kind === "location") {
    return [...locations.values()]
      .filter((l) => l.code && (!ids || ids.includes(l.id)))
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((l) => ({ id: l.id, code: l.code!, display: formatCode(l.code!), title: l.title, subtitle: l.path, kind: l.kind }));
  }
  const items = await listItems(organizationId, inv);
  return items
    .filter((i) => i.code && (!ids || ids.includes(i.id)))
    .map((i) => ({ id: i.id, code: i.code!, display: formatCode(i.code!), title: i.title, subtitle: i.locationPath, kind: null }));
}

export { PATH_SEPARATOR };
