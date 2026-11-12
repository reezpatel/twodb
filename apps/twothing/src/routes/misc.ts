import type { FastifyInstance } from "fastify";
import { sql } from "@twodb/core-data/db";
import { ulid } from "ulid";
import { z } from "zod";
import { logActivity, readActivity } from "../lib/activity.js";
import { parseCsv, toCsv } from "../lib/csv.js";
import { createItem, itemDto, listItems, type ItemInput } from "../lib/items.js";
import { LocationTree } from "../lib/locations.js";
import { formatCode } from "../lib/codes.js";
import { HttpError } from "../gateway-context.js";
import { authed, type Ctx } from "./context.js";

const MAX_IMAGE = 8 * 1024 * 1024;

const CSV_FIELDS = [
  ["name", "Name"],
  ["code", "Label"],
  ["category", "Category"],
  ["quantity", "Quantity"],
  ["unit", "Unit"],
  ["minQuantity", "Min stock"],
  ["location", "Location"],
  ["tags", "Tags"],
  ["barcodes", "Barcodes"],
  ["mpn", "Part number"],
  ["manufacturer", "Manufacturer"],
  ["supplier", "Supplier"],
  ["unitCost", "Unit cost"],
  ["purchaseUrl", "Purchase URL"],
  ["datasheetUrl", "Datasheet URL"],
  ["description", "Description"],
  ["notes", "Notes"],
] as const;

const HEADER_ALIASES: Record<string, string> = {
  name: "name", title: "name", item: "name",
  label: "code", code: "code", barcode: "code",
  category: "category", type: "category",
  quantity: "quantity", qty: "quantity", count: "quantity",
  unit: "unit", units: "unit",
  minstock: "minQuantity", minquantity: "minQuantity", min: "minQuantity", reorder: "minQuantity",
  location: "location", place: "location", box: "location", bin: "location",
  tags: "tags", groups: "tags",
  barcodes: "barcodes", ean: "barcodes", upc: "barcodes", manufacturerbarcode: "barcodes",
  partnumber: "mpn", mpn: "mpn", sku: "mpn",
  manufacturer: "manufacturer", brand: "manufacturer",
  supplier: "supplier", vendor: "supplier", store: "supplier",
  unitcost: "unitCost", cost: "unitCost", price: "unitCost",
  purchaseurl: "purchaseUrl", url: "purchaseUrl", link: "purchaseUrl",
  datasheeturl: "datasheetUrl", datasheet: "datasheetUrl",
  description: "description", notes: "notes",
};

export function registerMiscRoutes(app: FastifyInstance, { db }: Ctx) {
  // ---------------------------------------------------------------- stats
  app.get(
    "/stats",
    authed(async ({ workspaceId: ws }) => {
      const tree = await LocationTree.load(db, ws, true);
      const totals = await sql<{ items: number; units: number; value: number; low: number; unplaced: number; unlabeled: number }>`
        select count(*)::int as items,
          coalesce(sum(quantity), 0)::float as units,
          coalesce(sum(quantity * unit_cost), 0)::float as value,
          count(*) filter (where min_quantity is not null and quantity <= min_quantity)::int as low,
          count(*) filter (where location_id is null)::int as unplaced,
          count(*) filter (where code is null)::int as unlabeled
        from tt_item where workspace_id = ${ws}`.execute(db);
      const categories = await sql<{ category: string; n: number; value: number }>`
        select category, count(*)::int as n, coalesce(sum(quantity * unit_cost), 0)::float as value
        from tt_item where workspace_id = ${ws} group by category order by n desc`.execute(db);
      const lowRows = await db
        .selectFrom("tt_item")
        .selectAll()
        .where("workspace_id", "=", ws)
        .where(sql<boolean>`min_quantity is not null and quantity <= min_quantity`)
        .orderBy(sql`quantity / nullif(min_quantity, 0)`, "asc")
        .limit(8)
        .execute();
      const recentRows = await db.selectFrom("tt_item").selectAll().where("workspace_id", "=", ws).orderBy("created_at", "desc").limit(8).execute();
      const favRows = await db.selectFrom("tt_item").selectAll().where("workspace_id", "=", ws).where("favorite", "=", true).orderBy("name").limit(12).execute();
      return {
        totals: { ...totals.rows[0], locations: tree.byId.size },
        categories: categories.rows,
        lowStock: lowRows.map((r) => itemDto(r, tree)),
        recent: recentRows.map((r) => itemDto(r, tree)),
        favorites: favRows.map((r) => itemDto(r, tree)),
        activity: await readActivity(db, ws, { limit: 12 }),
      };
    }),
  );

  // ------------------------------------------------------------- activity
  app.get(
    "/activity",
    authed<Record<string, string>, { target?: string; limit?: string; before?: string }>(async ({ workspaceId: ws }, req) => ({
      entries: await readActivity(db, ws, { target: req.query.target, limit: req.query.limit ? Number(req.query.limit) : 50, before: req.query.before }),
    })),
  );

  // --------------------------------------------------------------- images
  // Raw body upload (client re-encodes to ≤1600px WebP/JPEG first).
  app.post(
    "/images",
    authed(async ({ workspaceId: ws }, req, reply) => {
      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) throw new HttpError(400, "empty_body");
      if (body.length > MAX_IMAGE) throw new HttpError(413, "image_too_large");
      const mime = String(req.headers["content-type"] ?? "");
      if (!mime.startsWith("image/")) throw new HttpError(400, "images_only");
      const id = ulid();
      await db.insertInto("tt_image").values({ id, workspace_id: ws, mime, data: body, created_at: new Date() }).execute();
      return reply.code(201).send({ id });
    }),
  );

  app.get(
    "/images/:id",
    authed<{ id: string }>(async ({ workspaceId: ws }, req, reply) => {
      const row = await db.selectFrom("tt_image").select(["mime", "data"]).where("workspace_id", "=", ws).where("id", "=", req.params.id).executeTakeFirst();
      if (!row) throw new HttpError(404, "image_not_found");
      return reply.header("content-type", row.mime).header("cache-control", "private, max-age=31536000, immutable").send(row.data);
    }),
  );

  // ----------------------------------------------------------- csv export
  app.get(
    "/export.csv",
    authed(async ({ workspaceId: ws }, _req, reply) => {
      const tree = await LocationTree.load(db, ws);
      const items = await listItems(db, ws, {}, tree);
      const rows = [
        [...CSV_FIELDS.map(([, h]) => h), "Specs"],
        ...items.map((i) => [
          i.name,
          i.code ? formatCode(i.code) : "",
          i.category,
          i.quantity,
          i.unit,
          i.minQuantity,
          i.locationPath.map((c) => c.name).join(" > "),
          i.tags.join("; "),
          i.barcodes.join("; "),
          i.mpn,
          i.manufacturer,
          i.supplier,
          i.unitCost,
          i.purchaseUrl,
          i.datasheetUrl,
          i.description,
          i.notes,
          Object.entries(i.specs)
            .map(([k, v]) => `${k}=${v}`)
            .join("; "),
        ]),
      ];
      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="twothing-${new Date().toISOString().slice(0, 10)}.csv"`)
        .send(toCsv(rows));
    }),
  );

  // ----------------------------------------------------------- csv import
  app.post(
    "/import",
    authed(async ({ workspaceId: ws, userId }, req) => {
      const body = z.object({ csv: z.string().max(5_000_000), dryRun: z.boolean().optional() }).parse(req.body);
      const table = parseCsv(body.csv);
      if (table.length < 2) throw new HttpError(400, "empty_csv");
      const header = table[0].map((h) => HEADER_ALIASES[h.toLowerCase().replace(/[^a-z]/g, "")] ?? (h.toLowerCase() === "specs" ? "specs" : null));
      if (!header.includes("name")) throw new HttpError(400, "name_column_required", { headers: table[0] });

      const tree = await LocationTree.load(db, ws);
      const pathIndex = new Map<string, string>();
      for (const id of tree.byId.keys()) pathIndex.set(tree.pathText(id).toLowerCase().replace(/\s*[›>/]\s*/g, ">"), id);

      const ensurePath = async (text: string): Promise<string | null> => {
        const parts = text.split(/\s*[›>/]\s*/).map((p) => p.trim()).filter(Boolean);
        if (!parts.length) return null;
        let parent: string | null = null;
        for (let i = 0; i < parts.length; i++) {
          const key = parts.slice(0, i + 1).join(">").toLowerCase();
          let id = pathIndex.get(key);
          if (!id) {
            id = ulid();
            if (!body.dryRun) {
              await db
                .insertInto("tt_location")
                .values({ id, workspace_id: ws, code: null, name: parts[i], kind: i === parts.length - 1 ? "box" : "shelf", parent_id: parent, description: "", color: null, image_id: null, created_at: new Date(), updated_at: new Date() })
                .execute();
            }
            pathIndex.set(key, id);
          }
          parent = id;
        }
        return parent;
      };

      const errors: { row: number; error: string }[] = [];
      let created = 0;
      for (let r = 1; r < table.length; r++) {
        const rec: Record<string, string> = {};
        header.forEach((k, i) => k && (rec[k] = (table[r][i] ?? "").trim()));
        if (!rec.name) {
          errors.push({ row: r + 1, error: "missing name" });
          continue;
        }
        const num = (v?: string) => (v ? Number(v.replace(/[^0-9.\-]/g, "")) : undefined);
        const list = (v?: string) => (v ? v.split(/[;,|]/).map((s) => s.trim()).filter(Boolean) : undefined);
        try {
          const input: ItemInput = {
            name: rec.name,
            code: rec.code || undefined,
            category: rec.category?.toLowerCase().replace(/[^a-z_]/g, "_") || undefined,
            quantity: num(rec.quantity),
            unit: rec.unit || undefined,
            minQuantity: num(rec.minQuantity) ?? null,
            locationId: rec.location ? await ensurePath(rec.location) : null,
            tags: list(rec.tags),
            barcodes: list(rec.barcodes),
            mpn: rec.mpn,
            manufacturer: rec.manufacturer,
            supplier: rec.supplier,
            unitCost: num(rec.unitCost) ?? null,
            purchaseUrl: rec.purchaseUrl,
            datasheetUrl: rec.datasheetUrl,
            description: rec.description,
            notes: rec.notes,
            specs: rec.specs
              ? Object.fromEntries(
                  rec.specs
                    .split(";")
                    .map((kv) => kv.split("=").map((s) => s.trim()))
                    .filter((kv) => kv.length === 2 && kv[0]),
                )
              : undefined,
          };
          for (const k of ["quantity", "unitCost", "minQuantity"] as const) if (Number.isNaN(input[k] as number)) throw new Error(`bad number in ${k}`);
          if (!body.dryRun) await createItem(db, ws, userId, input);
          created++;
        } catch (e) {
          errors.push({ row: r + 1, error: e instanceof HttpError ? e.code : (e as Error).message });
        }
      }
      if (!body.dryRun && created)
        await logActivity(db, ws, userId, { targetKind: "item", targetId: "import", targetName: `CSV import (${created} items)`, action: "imported", detail: { created, errors: errors.length } });
      return { created, errors, dryRun: !!body.dryRun, columns: header };
    }),
  );
}
