import { sql, type Kysely } from "@twodb/core-data/db";
import { ulid } from "ulid";
import { z } from "zod";
import type { ItemRow, TwoThingDb } from "../db/schema.js";
import { HttpError } from "../gateway-context.js";
import { logActivity } from "./activity.js";
import { assertCodeFree, generateCodes, trackCode } from "./code-pool.js";
import { formatCode, normalizeCode } from "./codes.js";
import { LocationTree, type Crumb } from "./locations.js";

const str = (max: number) => z.string().trim().max(max);

export const itemInput = z.object({
  name: str(200).min(1),
  description: str(4000).optional(),
  category: str(40).optional(),
  quantity: z.number().finite().min(0).optional(),
  unit: str(20).optional(),
  minQuantity: z.number().finite().min(0).nullable().optional(),
  locationId: z.string().nullable().optional(),
  /** Our label code (scanned off a pre-printed sticker or typed). */
  code: z.string().nullable().optional(),
  /** true → pull a fresh code from the pool when `code` is empty. */
  autoCode: z.boolean().optional(),
  tags: z.array(str(40).min(1)).max(50).optional(),
  barcodes: z.array(str(512).min(1)).max(20).optional(),
  specs: z.record(z.string().max(60), z.string().max(500)).optional(),
  imageIds: z.array(z.string()).max(20).optional(),
  mpn: str(120).optional(),
  manufacturer: str(120).optional(),
  supplier: str(120).optional(),
  unitCost: z.number().finite().min(0).nullable().optional(),
  purchaseUrl: str(2000).optional(),
  datasheetUrl: str(2000).optional(),
  notes: str(10000).optional(),
  favorite: z.boolean().optional(),
});
export type ItemInput = z.infer<typeof itemInput>;
export const itemPatch = itemInput.partial();

export interface ItemDto {
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

export const isLow = (r: Pick<ItemRow, "quantity" | "min_quantity">) => r.min_quantity !== null && Number(r.quantity) <= Number(r.min_quantity);

export function itemDto(r: ItemRow, tree: LocationTree): ItemDto {
  return {
    id: r.id,
    code: r.code,
    codeDisplay: r.code ? formatCode(r.code) : null,
    name: r.name,
    description: r.description,
    category: r.category,
    quantity: Number(r.quantity),
    unit: r.unit,
    minQuantity: r.min_quantity === null ? null : Number(r.min_quantity),
    low: isLow(r),
    locationId: r.location_id,
    locationPath: tree.path(r.location_id),
    tags: r.tags ?? [],
    barcodes: r.barcodes ?? [],
    specs: r.specs ?? {},
    imageIds: r.image_ids ?? [],
    mpn: r.mpn,
    manufacturer: r.manufacturer,
    supplier: r.supplier,
    unitCost: r.unit_cost === null ? null : Number(r.unit_cost),
    purchaseUrl: r.purchase_url,
    datasheetUrl: r.datasheet_url,
    notes: r.notes,
    favorite: r.favorite,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export interface ItemFilters {
  q?: string;
  category?: string;
  locationId?: string;
  recursive?: boolean;
  tag?: string;
  low?: boolean;
  unplaced?: boolean;
  favorite?: boolean;
  sort?: "name" | "updated" | "created" | "quantity";
  limit?: number;
}

export async function listItems(db: Kysely<TwoThingDb>, ws: string, f: ItemFilters, tree: LocationTree) {
  let q = db.selectFrom("tt_item").selectAll().where("workspace_id", "=", ws);
  if (f.q?.trim()) {
    // Every whitespace-separated term must match somewhere (name, code, specs, tags…).
    for (const term of f.q.trim().split(/\s+/).slice(0, 8)) {
      const like = `%${term.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
      const asCode = normalizeCode(term);
      q = q.where((eb) =>
        eb.or([
          eb("name", "ilike", like),
          eb("description", "ilike", like),
          eb("mpn", "ilike", like),
          eb("manufacturer", "ilike", like),
          eb("notes", "ilike", like),
          eb(sql`tags::text`, "ilike", like),
          eb(sql`specs::text`, "ilike", like),
          eb(sql`barcodes::text`, "ilike", like),
          eb("code", "ilike", like),
          ...(asCode ? [eb("code", "=", asCode)] : []),
        ]),
      );
    }
  }
  if (f.category) q = q.where("category", "=", f.category);
  if (f.tag) q = q.where(sql<boolean>`tags @> ${JSON.stringify([f.tag])}::jsonb`);
  if (f.low) q = q.where(sql<boolean>`min_quantity is not null and quantity <= min_quantity`);
  if (f.unplaced) q = q.where("location_id", "is", null);
  if (f.favorite) q = q.where("favorite", "=", true);
  if (f.locationId) {
    const ids = f.recursive === false ? [f.locationId] : tree.descendants(f.locationId);
    q = q.where("location_id", "in", ids);
  }
  switch (f.sort) {
    case "updated":
      q = q.orderBy("updated_at", "desc");
      break;
    case "created":
      q = q.orderBy("created_at", "desc");
      break;
    case "quantity":
      q = q.orderBy("quantity", "asc");
      break;
    default:
      q = q.orderBy(sql`lower(name)`, "asc");
  }
  const rows = await q.limit(Math.min(f.limit ?? 2000, 5000)).execute();
  return rows.map((r) => itemDto(r, tree));
}

export async function getItemRow(db: Kysely<TwoThingDb>, ws: string, id: string) {
  const row = await db.selectFrom("tt_item").selectAll().where("workspace_id", "=", ws).where("id", "=", id).executeTakeFirst();
  if (!row) throw new HttpError(404, "item_not_found");
  return row;
}

async function requireLocation(db: Kysely<TwoThingDb>, ws: string, id: string | null | undefined) {
  if (!id) return null;
  const row = await db.selectFrom("tt_location").select("id").where("workspace_id", "=", ws).where("id", "=", id).executeTakeFirst();
  if (!row) throw new HttpError(400, "location_not_found");
  return id;
}

/** Normalise + validate a label code coming from the client. */
async function resolveLabel(db: Kysely<TwoThingDb>, ws: string, raw: string | null | undefined, self?: { kind: "item" | "location"; id: string }) {
  if (raw === undefined) return undefined;
  if (raw === null || raw.trim() === "") return null;
  const code = normalizeCode(raw) ?? raw.trim().toUpperCase().slice(0, 64);
  await assertCodeFree(db, ws, code, self);
  await trackCode(db, ws, code);
  return code;
}

export { resolveLabel };

const cleanList = (xs: string[] | undefined) => (xs ? [...new Set(xs.map((x) => x.trim()).filter(Boolean))] : undefined);
const cleanSpecs = (s: Record<string, string> | undefined) =>
  s ? Object.fromEntries(Object.entries(s).filter(([k, v]) => k.trim() && v.trim()).map(([k, v]) => [k.trim(), v.trim()])) : undefined;

export async function createItem(db: Kysely<TwoThingDb>, ws: string, userId: string | null, input: ItemInput) {
  let code = await resolveLabel(db, ws, input.code);
  if (!code && input.autoCode) code = (await generateCodes(db, ws, 1, { batch: false })).codes[0];
  const locationId = await requireLocation(db, ws, input.locationId);
  const now = new Date();
  const row: ItemRow = {
    id: ulid(),
    workspace_id: ws,
    code: code ?? null,
    name: input.name,
    description: input.description ?? "",
    category: input.category || "other",
    quantity: input.quantity ?? 1,
    unit: input.unit || "pcs",
    min_quantity: input.minQuantity ?? null,
    location_id: locationId,
    tags: cleanList(input.tags) ?? [],
    barcodes: cleanList(input.barcodes) ?? [],
    specs: cleanSpecs(input.specs) ?? {},
    image_ids: input.imageIds ?? [],
    mpn: input.mpn ?? "",
    manufacturer: input.manufacturer ?? "",
    supplier: input.supplier ?? "",
    unit_cost: input.unitCost ?? null,
    purchase_url: input.purchaseUrl ?? "",
    datasheet_url: input.datasheetUrl ?? "",
    notes: input.notes ?? "",
    favorite: input.favorite ?? false,
    created_at: now,
    updated_at: now,
  };
  await db
    .insertInto("tt_item")
    .values({ ...row, tags: JSON.stringify(row.tags), barcodes: JSON.stringify(row.barcodes), specs: JSON.stringify(row.specs), image_ids: JSON.stringify(row.image_ids) } as never)
    .execute();
  await logActivity(db, ws, userId, { targetKind: "item", targetId: row.id, targetName: row.name, action: "created", detail: { quantity: row.quantity, unit: row.unit } });
  return row;
}

const FIELD_MAP: Record<string, keyof ItemRow> = {
  name: "name",
  description: "description",
  category: "category",
  unit: "unit",
  minQuantity: "min_quantity",
  tags: "tags",
  barcodes: "barcodes",
  specs: "specs",
  imageIds: "image_ids",
  mpn: "mpn",
  manufacturer: "manufacturer",
  supplier: "supplier",
  unitCost: "unit_cost",
  purchaseUrl: "purchase_url",
  datasheetUrl: "datasheet_url",
  notes: "notes",
  favorite: "favorite",
};
const JSON_COLS = new Set<keyof ItemRow>(["tags", "barcodes", "specs", "image_ids"]);

export async function updateItem(db: Kysely<TwoThingDb>, ws: string, userId: string | null, id: string, patch: z.infer<typeof itemPatch>, tree: LocationTree) {
  const prev = await getItemRow(db, ws, id);
  const set: Record<string, unknown> = {};
  const changed: string[] = [];

  const p = { ...patch, tags: cleanList(patch.tags), barcodes: cleanList(patch.barcodes), specs: cleanSpecs(patch.specs) };
  for (const [key, col] of Object.entries(FIELD_MAP)) {
    const v = (p as Record<string, unknown>)[key];
    if (v === undefined) continue;
    if (JSON.stringify(v) === JSON.stringify(prev[col])) continue;
    set[col] = JSON_COLS.has(col) ? JSON.stringify(v) : v;
    changed.push(key);
  }

  let codeChanged = false;
  if (patch.code !== undefined || patch.autoCode) {
    let code = await resolveLabel(db, ws, patch.code, { kind: "item", id });
    if (!code && patch.autoCode) code = (await generateCodes(db, ws, 1, { batch: false })).codes[0];
    if (code !== undefined && code !== prev.code) {
      set.code = code;
      codeChanged = true;
    }
  }

  let moved = false;
  if (patch.locationId !== undefined && patch.locationId !== prev.location_id) {
    set.location_id = await requireLocation(db, ws, patch.locationId);
    moved = true;
  }

  const qtyChanged = patch.quantity !== undefined && patch.quantity !== Number(prev.quantity);
  if (qtyChanged) set.quantity = patch.quantity;

  if (Object.keys(set).length === 0) return prev;
  set.updated_at = new Date();
  await db.updateTable("tt_item").set(set as never).where("id", "=", id).where("workspace_id", "=", ws).execute();

  const name = (set.name as string) ?? prev.name;
  if (changed.length) await logActivity(db, ws, userId, { targetKind: "item", targetId: id, targetName: name, action: "updated", detail: { fields: changed } });
  if (qtyChanged)
    await logActivity(db, ws, userId, {
      targetKind: "item",
      targetId: id,
      targetName: name,
      action: "quantity",
      detail: { from: Number(prev.quantity), to: patch.quantity, delta: patch.quantity! - Number(prev.quantity) },
    });
  if (moved)
    await logActivity(db, ws, userId, {
      targetKind: "item",
      targetId: id,
      targetName: name,
      action: "moved",
      detail: { from: tree.pathText(prev.location_id) || null, to: tree.pathText(set.location_id as string | null) || null, toId: set.location_id ?? null },
    });
  if (codeChanged) await logActivity(db, ws, userId, { targetKind: "item", targetId: id, targetName: name, action: "labeled", detail: { from: prev.code, to: set.code ?? null } });
  return getItemRow(db, ws, id);
}

export async function adjustQuantity(db: Kysely<TwoThingDb>, ws: string, userId: string | null, id: string, body: { delta?: number; set?: number; reason?: string }) {
  const prev = await getItemRow(db, ws, id);
  const from = Number(prev.quantity);
  const to = body.set !== undefined ? body.set : from + (body.delta ?? 0);
  if (!Number.isFinite(to)) throw new HttpError(400, "invalid_quantity");
  const next = Math.max(0, Math.round(to * 1000) / 1000);
  if (next === from) return prev;
  await db.updateTable("tt_item").set({ quantity: next, updated_at: new Date() }).where("id", "=", id).where("workspace_id", "=", ws).execute();
  await logActivity(db, ws, userId, {
    targetKind: "item",
    targetId: id,
    targetName: prev.name,
    action: "quantity",
    detail: { from, to: next, delta: Math.round((next - from) * 1000) / 1000, ...(body.reason ? { reason: body.reason } : {}) },
  });
  return getItemRow(db, ws, id);
}

export async function moveItems(db: Kysely<TwoThingDb>, ws: string, userId: string | null, ids: string[], locationId: string | null, tree: LocationTree) {
  await requireLocation(db, ws, locationId);
  const rows = await db.selectFrom("tt_item").selectAll().where("workspace_id", "=", ws).where("id", "in", ids.length ? ids : ["-"]).execute();
  const moving = rows.filter((r) => r.location_id !== locationId);
  if (!moving.length) return 0;
  await db
    .updateTable("tt_item")
    .set({ location_id: locationId, updated_at: new Date() })
    .where("workspace_id", "=", ws)
    .where(
      "id",
      "in",
      moving.map((r) => r.id),
    )
    .execute();
  for (const r of moving)
    await logActivity(db, ws, userId, {
      targetKind: "item",
      targetId: r.id,
      targetName: r.name,
      action: "moved",
      detail: { from: tree.pathText(r.location_id) || null, to: tree.pathText(locationId) || null, toId: locationId },
    });
  return moving.length;
}

export async function deleteItem(db: Kysely<TwoThingDb>, ws: string, userId: string | null, id: string) {
  const prev = await getItemRow(db, ws, id);
  await db.deleteFrom("tt_item").where("id", "=", id).where("workspace_id", "=", ws).execute();
  if (prev.image_ids?.length) await db.deleteFrom("tt_image").where("workspace_id", "=", ws).where("id", "in", prev.image_ids).execute();
  await logActivity(db, ws, userId, { targetKind: "item", targetId: id, targetName: prev.name, action: "deleted", detail: { code: prev.code, quantity: Number(prev.quantity) } });
}

export async function listTags(db: Kysely<TwoThingDb>, ws: string) {
  const rows = await sql<{ tag: string; n: number }>`
    select t.tag, count(*)::int as n
    from tt_item, jsonb_array_elements_text(tags) as t(tag)
    where workspace_id = ${ws}
    group by t.tag order by n desc, t.tag asc limit 500`.execute(db);
  return rows.rows;
}
