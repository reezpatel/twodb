import { Hono, type Context } from "hono";
import { requireOrgSession } from "../lib/session";
import { actorOf, RowHookError } from "../lib/locked-databases";
import { storeNoteAsset } from "../lib/assets";
import { logger } from "../lib/logger";
import {
  adjustQuantity,
  breadcrumb,
  createInventory,
  getInventory,
  getItem,
  inventorySummary,
  labelData,
  listGroups,
  listInventories,
  listItems,
  loadLocations,
  moveItem,
  readLog,
  resolveCode,
  type InventoryRecord,
} from "../lib/inventory";
import { exportItemsCsv, IMPORT_FIELDS, importItemsCsv } from "../lib/inventory-io";

type Session = NonNullable<Awaited<ReturnType<typeof requireOrgSession>>>;

/** Auth + inventory lookup + RowHookError → JSON error mapping. */
async function withInventory(c: Context, fn: (s: Session, inv: InventoryRecord) => Promise<Response>): Promise<Response> {
  const s = await requireOrgSession(c);
  if (!s) return c.body(null, 401);
  const inv = await getInventory(s.organizationId, c.req.param("id") ?? "");
  if (!inv) return c.json({ error: "inventory_not_found" }, 404);
  try {
    return await fn(s, inv);
  } catch (e) {
    if (e instanceof RowHookError) return c.json({ error: e.code, ...(e.detail ? { detail: e.detail } : {}) }, e.status);
    throw e;
  }
}

const flag = (v: string | undefined) => v === "1" || v === "true";

export const inventoryRoutes = new Hono()
  .get("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    return c.json({ inventories: await listInventories(s.organizationId), importFields: IMPORT_FIELDS.map((f) => ({ key: f.key, label: f.label })) });
  })

  .post("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name : "";
    return c.json(await createInventory(s.organizationId, name), 201);
  })

  .get("/:id/summary", (c) => withInventory(c, async (s, inv) => c.json(await inventorySummary(s.organizationId, inv))))

  .get("/:id/items", (c) =>
    withInventory(c, async (s, inv) => {
      const q = c.req.query();
      const items = await listItems(s.organizationId, inv, {
        q: q.q,
        group: q.group || undefined,
        location: q.location || undefined,
        recursive: q.recursive === undefined ? true : flag(q.recursive),
        low: flag(q.low),
        unplaced: flag(q.unplaced),
      });
      return c.json({ items });
    }),
  )

  .get("/:id/low-stock", (c) => withInventory(c, async (s, inv) => c.json({ items: await listItems(s.organizationId, inv, { low: true }) })))

  .get("/:id/items/:itemId", (c) =>
    withInventory(c, async (s, inv) => {
      const item = await getItem(s.organizationId, inv, c.req.param("itemId") ?? "");
      if (!item) return c.json({ error: "item_not_found" }, 404);
      const locations = await loadLocations(s.organizationId, inv);
      return c.json({ item, breadcrumb: breadcrumb(locations, item.locationId) });
    }),
  )

  .post("/:id/items/:itemId/adjust", (c) =>
    withInventory(c, async (s, inv) => {
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object") return c.json({ error: "invalid_body" }, 400);
      return c.json(await adjustQuantity(s.organizationId, inv, c.req.param("itemId") ?? "", body, actorOf(s)));
    }),
  )

  .post("/:id/items/:itemId/move", (c) =>
    withInventory(c, async (s, inv) => {
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object" || !("locationId" in body)) return c.json({ error: "invalid_body" }, 400);
      return c.json(await moveItem(s.organizationId, inv, c.req.param("itemId") ?? "", body.locationId, body.reason, actorOf(s)));
    }),
  )

  /** Image upload for items/locations: returns the media id to put in the
   *  row's `images` property (via the generic row PATCH). */
  .post("/:id/uploads", (c) =>
    withInventory(c, async (s) => {
      const form = await c.req.parseBody().catch(() => null);
      const file = form?.["file"];
      if (!file || typeof file === "string") return c.json({ error: "invalid_file" }, 400);
      if (file.size === 0) return c.json({ error: "empty_file" }, 400);
      if (file.size > 25 * 1024 * 1024) return c.json({ error: "file_too_large" }, 413);
      if (file.type && !file.type.startsWith("image/")) return c.json({ error: "images_only" }, 400);
      try {
        const asset = await storeNoteAsset({
          organizationId: s.organizationId,
          filename: file.name || "inventory-image",
          contentType: file.type || null,
          data: Buffer.from(await file.arrayBuffer()),
        });
        return c.json({ id: asset.id }, 201);
      } catch (e) {
        const message = (e as Error).message;
        if (message === "note_assets_not_configured") return c.json({ error: message }, 409);
        logger.error({ err: e }, "inventory: image upload failed");
        return c.json({ error: message || "upload_failed" }, 500);
      }
    }),
  )

  .get("/:id/groups", (c) => withInventory(c, async (s, inv) => c.json({ groups: await listGroups(s.organizationId, inv) })))

  .get("/:id/locations", (c) =>
    withInventory(c, async (s, inv) => {
      const locations = [...(await loadLocations(s.organizationId, inv)).values()].sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: "base" }));
      return c.json({ locations });
    }),
  )

  .get("/:id/resolve", (c) =>
    withInventory(c, async (s, inv) => c.json({ matches: await resolveCode(s.organizationId, inv, c.req.query("code") ?? "") })),
  )

  .get("/:id/log", (c) =>
    withInventory(c, async (s, inv) => {
      const q = c.req.query();
      return c.json({ entries: await readLog(s.organizationId, inv, { target: q.target || undefined, limit: Number(q.limit) || undefined, offset: Number(q.offset) || undefined }) });
    }),
  )

  .get("/:id/export.csv", (c) =>
    withInventory(c, async (s, inv) => {
      const csv = await exportItemsCsv(s.organizationId, inv);
      return c.body(csv, 200, {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${inv.name.replace(/[^\w.-]+/g, "_") || "inventory"}-items.csv"`,
      });
    }),
  )

  .post("/:id/import", (c) =>
    withInventory(c, async (s, inv) => {
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body.csv !== "string") return c.json({ error: "csv_required" }, 400);
      const mapping = body.mapping && typeof body.mapping === "object" ? (body.mapping as Record<string, string>) : undefined;
      return c.json(await importItemsCsv(s.organizationId, inv, body.csv, { mapping, dryRun: body.dryRun === true, actor: actorOf(s) }));
    }),
  )

  .get("/:id/labels", (c) =>
    withInventory(c, async (s, inv) => {
      const kind = c.req.query("kind") === "location" ? "location" : "item";
      const ids = c.req.query("ids")?.split(",").filter(Boolean);
      return c.json({ labels: await labelData(s.organizationId, inv, kind, ids?.length ? ids : undefined) });
    }),
  );
