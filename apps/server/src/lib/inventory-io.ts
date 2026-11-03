import { sql } from "kysely";
import { db } from "../auth";
import { parseCsv, toCsv } from "./csv";
import { normalizeCode } from "./inventory-codes";
import { insertItem, insertLocation, ITEM_PROPS, LOCATION_PROPS, listItems, loadLocations, writeLog, type InventoryRecord } from "./inventory";
import { RowHookError, type RowActor } from "./locked-databases";
import { notesTable, updateRowProps } from "./notes-tables";

export const IMPORT_FIELDS = [
  { key: "code", label: "Barcode", aliases: ["code", "id", "barcode", "autoid"] },
  { key: "title", label: "Title", aliases: ["name", "item", "title"] },
  { key: "description", label: "Description", aliases: ["description", "notes", "details"] },
  { key: "quantity", label: "Quantity", aliases: ["quantity", "qty", "stock", "count", "amount"] },
  { key: "unit", label: "Unit", aliases: ["unit", "uom"] },
  { key: "min_quantity", label: "Min stock", aliases: ["minstock", "minquantity", "minqty", "reorderlevel", "threshold"] },
  { key: "location_path", label: "Location", aliases: ["location", "locationpath", "path", "place", "storage"] },
  { key: "groups", label: "Groups", aliases: ["groups", "group", "category", "categories", "tags"] },
  { key: "sku", label: "SKU", aliases: ["sku", "partno", "partnumber", "mpn"] },
  { key: "ext_barcode", label: "Manufacturer barcode", aliases: ["manufacturerbarcode", "extbarcode", "ean", "upc", "gtin", "externalbarcode"] },
  { key: "supplier", label: "Supplier", aliases: ["supplier", "vendor"] },
  { key: "unit_cost", label: "Unit cost", aliases: ["unitcost", "cost", "price"] },
  { key: "purchased_at", label: "Purchased", aliases: ["purchased", "purchasedat", "purchasedate", "boughton"] },
  { key: "expires_at", label: "Expiry / warranty", aliases: ["expiry", "expires", "expiresat", "expirydate", "warranty", "warrantyexpiry"] },
  { key: "product_url", label: "Link", aliases: ["link", "url", "producturl"] },
] as const;

type FieldKey = (typeof IMPORT_FIELDS)[number]["key"];

const simplify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function autoMapping(headers: string[]): Record<string, FieldKey> {
  const mapping: Record<string, FieldKey> = {};
  const used = new Set<FieldKey>();
  for (const header of headers) {
    const h = simplify(header);
    if (!h) continue;
    const field = IMPORT_FIELDS.find((f) => !used.has(f.key) && (simplify(f.label) === h || f.key.replace(/_/g, "") === h || (f.aliases as readonly string[]).includes(h)));
    if (field) {
      mapping[header] = field.key;
      used.add(field.key);
    }
  }
  return mapping;
}

const localDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export async function exportItemsCsv(organizationId: string, inv: InventoryRecord): Promise<string> {
  const items = await listItems(organizationId, inv);
  const rows: unknown[][] = [IMPORT_FIELDS.map((f) => f.label)];
  for (const i of items) {
    rows.push([
      i.code,
      i.title,
      i.description,
      i.quantity,
      i.unit,
      i.minQuantity,
      i.locationPath,
      i.groups.join("; "),
      i.sku,
      i.extBarcode,
      i.supplier,
      i.unitCost,
      localDate(i.purchasedAt),
      localDate(i.expiresAt),
      i.productUrl,
    ]);
  }
  return toCsv(rows);
}

const PATH_SPLIT = /\s*(?:›|>|\/)\s*/;

function parseNumber(text: string, field: string): number {
  const cleaned = text.replace(/[,\s]/g, "").replace(/^[^\d.+-]+(?=[\d.+-])/, "");
  const n = cleaned === "" ? NaN : Number(cleaned);
  if (!Number.isFinite(n)) throw new RowHookError(`invalid_value:${field}`);
  return n;
}

function parseDate(text: string, field: string): Date {
  const t = Date.parse(text);
  if (Number.isNaN(t)) throw new RowHookError(`invalid_value:${field}`);
  return new Date(t);
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

export async function importItemsCsv(
  organizationId: string,
  inv: InventoryRecord,
  csv: string,
  opts: { mapping?: Record<string, string>; dryRun?: boolean; actor: RowActor },
): Promise<ImportResult> {
  const table = parseCsv(csv);
  const headers = table[0]?.map((h) => h.trim()) ?? [];
  const data = table.slice(1);
  const mapping = opts.mapping ?? autoMapping(headers);
  const result: ImportResult = { headers, mapping, total: data.length, preview: data.slice(0, 5), created: 0, updated: 0, locationsCreated: 0, errors: [] };
  if (opts.dryRun || data.length === 0) return result;

  const validKeys = new Set<string>(IMPORT_FIELDS.map((f) => f.key));
  const columns = headers.map((h) => (mapping[h] && validKeys.has(mapping[h]) ? (mapping[h] as FieldKey) : null));
  if (!columns.includes("title")) {
    result.errors.push({ row: 0, error: "title_column_required" });
    return result;
  }

  const locations = await loadLocations(organizationId, inv);
  const byPath = new Map<string, string>();
  for (const l of locations.values()) byPath.set(l.path.toLowerCase(), l.id);

  const resolveLocation = async (pathText: string): Promise<string | null> => {
    const segments = pathText.split(PATH_SPLIT).map((s) => s.trim()).filter(Boolean);
    let parent: string | null = null;
    let acc = "";
    for (const [depth, segment] of segments.entries()) {
      acc = acc ? `${acc} › ${segment}` : segment;
      let id = byPath.get(acc.toLowerCase());
      if (!id) {
        id = await insertLocation(organizationId, inv, { title: segment, props: { [LOCATION_PROPS.parent]: parent, [LOCATION_PROPS.kind]: depth === 0 ? "warehouse" : "other" } }, opts.actor);
        byPath.set(acc.toLowerCase(), id);
        result.locationsCreated++;
      }
      parent = id;
    }
    return parent;
  };

  const existing = await sql<{ noteId: string; code: string }>`SELECT "noteId", "code" FROM ${notesTable(inv.items)} WHERE "code" IS NOT NULL`.execute(db);
  const byCode = new Map(existing.rows.map((r) => [r.code, r.noteId]));

  for (const [index, cells] of data.entries()) {
    const rowNumber = index + 2;
    try {
      const values: Partial<Record<FieldKey, string>> = {};
      columns.forEach((key, i) => {
        const text = (cells[i] ?? "").trim();
        if (key && text) values[key] = text;
      });
      const props: Record<string, unknown> = {};
      if (values.description) props[ITEM_PROPS.description] = values.description;
      if (values.quantity) props[ITEM_PROPS.quantity] = parseNumber(values.quantity, "quantity");
      if (values.unit) props[ITEM_PROPS.unit] = values.unit;
      if (values.min_quantity) props[ITEM_PROPS.minQuantity] = parseNumber(values.min_quantity, "min_quantity");
      if (values.groups) props[ITEM_PROPS.groups] = [...new Set(values.groups.split(/[;|,]/).map((g) => g.trim()).filter(Boolean))];
      if (values.sku) props[ITEM_PROPS.sku] = values.sku;
      if (values.ext_barcode) props[ITEM_PROPS.extBarcode] = values.ext_barcode;
      if (values.supplier) props[ITEM_PROPS.supplier] = values.supplier;
      if (values.unit_cost) props[ITEM_PROPS.unitCost] = parseNumber(values.unit_cost, "unit_cost");
      if (values.purchased_at) props[ITEM_PROPS.purchasedAt] = parseDate(values.purchased_at, "purchased_at");
      if (values.expires_at) props[ITEM_PROPS.expiresAt] = parseDate(values.expires_at, "expires_at");
      if (values.product_url) props[ITEM_PROPS.productUrl] = values.product_url;
      if (values.location_path) props[ITEM_PROPS.location] = await resolveLocation(values.location_path);

      const code = values.code ? normalizeCode(values.code) : null;
      if (values.code && !code) throw new RowHookError("invalid_code");
      const existingId = code ? byCode.get(code) : undefined;

      if (existingId) {
        await updateRowProps(db, inv.items, existingId, props);
        if (values.title) await db.updateTable("note_node").set({ title: values.title.slice(0, 200), updatedAt: new Date() }).where("id", "=", existingId).execute();
        await writeLog(organizationId, inv, {
          target: existingId,
          targetKind: "item",
          targetLabel: `${values.title ?? code}`,
          action: "imported",
          title: `Updated from import: ${values.title ?? code}`,
          actor: opts.actor,
        });
        result.updated++;
        continue;
      }
      if (!values.title) throw new RowHookError("title_required");
      if (code) props[ITEM_PROPS.code] = code;
      const id = await insertItem(organizationId, inv, { title: values.title.slice(0, 200), props }, opts.actor, true);
      if (code) byCode.set(code, id);
      result.created++;
    } catch (e) {
      result.errors.push({ row: rowNumber, error: e instanceof RowHookError ? (e.detail ? `${e.code}: ${e.detail}` : e.code) : (e as Error).message });
    }
  }
  return result;
}
