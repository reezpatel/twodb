/** Integration smoke test for the inventory feature. Creates its own
 *  organization and removes it afterwards. Point it at a scratch database:
 *    TWODB_DATABASE_URL=postgres://… tsx scripts/inventory-smoke.ts */
import assert from "node:assert/strict";
import { db } from "../src/auth";
import {
  adjustQuantity,
  createInventory,
  getItem,
  insertItem,
  insertLocation,
  inventorySummary,
  labelData,
  listGroups,
  listItems,
  loadLocations,
  moveItem,
  readLog,
  resolveCode,
} from "../src/lib/inventory";
import { exportItemsCsv, importItemsCsv } from "../src/lib/inventory-io";
import { hooksFor, RowHookError, runBeforeUpdate, snapshotRow } from "../src/lib/locked-databases";
import { updateRowProps } from "../src/lib/notes-tables";
import { getNode } from "../src/lib/notes-nodes";

const orgId = `org_smoke_${Date.now()}`;
const actor = { id: null, name: "smoke" };

async function rejects(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
  } catch (e) {
    assert.ok(e instanceof RowHookError, `expected RowHookError, got ${e}`);
    assert.equal(e.code, code);
    return;
  }
  assert.fail(`expected ${code}`);
}

async function renameLocation(inv: { locations: string }, id: string, title: string) {
  const database = (await getNode(orgId, inv.locations, { includeDeleted: true }))!;
  const hooks = hooksFor(database)!;
  const ctx = { organizationId: orgId, database, actor };
  const prev = (await snapshotRow(inv.locations, id))!;
  const patch = await runBeforeUpdate(ctx, prev, { title, props: {} });
  await db.updateTable("note_node").set({ title: patch.title ?? title }).where("id", "=", id).execute();
  if (Object.keys(patch.props).length) await updateRowProps(db, inv.locations, id, patch.props);
  await hooks.afterUpdate!(ctx, prev, (await snapshotRow(inv.locations, id))!);
}

async function main() {
  await db.insertInto("organization").values({ id: orgId, name: "Smoke", slug: orgId, createdAt: new Date() } as never).execute();
  try {
    const inv = await createInventory(orgId, "Workshop");
    const locs = await db.selectFrom("note_node").select(["id", "title", "schemaLockedBy"]).where("parentId", "=", inv.sectionId).execute();
    assert.equal(locs.length, 3);

    const wh = await insertLocation(orgId, inv, { title: "Warehouse A", props: { kind: "warehouse" } }, actor);
    const rack = await insertLocation(orgId, inv, { title: "Rack 3", props: { parent: wh, kind: "rack" } }, actor);
    const box = await insertLocation(orgId, inv, { title: "Box 12", props: { parent: rack, kind: "box" } }, actor);
    let tree = await loadLocations(orgId, inv);
    assert.equal(tree.get(box)!.path, "Warehouse A › Rack 3 › Box 12");
    assert.match(tree.get(box)!.code!, /^[0-9A-HJKMNP-TV-Z]{8}$/);

    const screws = await insertItem(orgId, inv, { title: "M4 screws", props: { quantity: 40, location: box, groups: ["Hardware", "Fasteners"], ext_barcode: "4006381333931", min_quantity: 10 } }, actor);
    const drill = await insertItem(orgId, inv, { title: "Drill", props: { unit_cost: 59.9, quantity: 1 } }, actor);
    const item = (await getItem(orgId, inv, screws))!;
    assert.equal(item.locationPath, "Warehouse A › Rack 3 › Box 12");
    assert.equal(item.quantity, 40);

    await rejects(() => insertItem(orgId, inv, { title: "bad", props: { quantity: -1 } }, actor), "invalid_value:quantity");
    await rejects(() => insertItem(orgId, inv, { title: "bad", props: { location: "nope" } }, actor), "invalid_location:location");
    await rejects(() => insertItem(orgId, inv, { title: "dup", props: { code: item.code } }, actor), "code_taken");

    await renameLocation(inv, rack, "Rack 7");
    tree = await loadLocations(orgId, inv);
    assert.equal(tree.get(box)!.path, "Warehouse A › Rack 7 › Box 12");
    assert.equal(tree.get(wh)!.totalItems, 1);
    assert.equal(tree.get(rack)!.itemCount, 0);

    const locDb = (await getNode(orgId, inv.locations, { includeDeleted: true }))!;
    const locCtx = { organizationId: orgId, database: locDb, actor };
    await rejects(async () => {
      const prev = (await snapshotRow(inv.locations, wh))!;
      await runBeforeUpdate(locCtx, prev, { props: { parent: box } });
    }, "location_cycle");
    await rejects(async () => hooksFor(locDb)!.beforeDelete!(locCtx, (await snapshotRow(inv.locations, box))!), "location_not_empty");

    assert.deepEqual(await adjustQuantity(orgId, inv, screws, { delta: -15, reason: "used" }, actor), { quantity: 25, previous: 40 });
    await rejects(() => adjustQuantity(orgId, inv, screws, { delta: -100 }, actor), "insufficient_stock");
    assert.deepEqual(await adjustQuantity(orgId, inv, screws, { set: 8 }, actor), { quantity: 8, previous: 25 });
    await rejects(() => adjustQuantity(orgId, inv, screws, { set: -1 }, actor), "invalid_quantity");
    await rejects(() => adjustQuantity(orgId, inv, screws, { delta: 0 }, actor), "invalid_delta");

    const moved = await moveItem(orgId, inv, drill, rack, "bench", actor);
    assert.equal(moved.locationPath, "Warehouse A › Rack 7");
    assert.equal((await moveItem(orgId, inv, drill, null, null, actor)).locationPath, null);
    await rejects(() => moveItem(orgId, inv, drill, "nope", null, actor), "invalid_location:location");

    assert.equal((await listItems(orgId, inv, { low: true })).length, 1);
    assert.equal((await listItems(orgId, inv, { location: wh })).length, 1);
    assert.equal((await listItems(orgId, inv, { location: wh, recursive: false })).length, 0);
    assert.equal((await listItems(orgId, inv, { unplaced: true })).length, 1);
    assert.equal((await listItems(orgId, inv, { q: "screw" })).length, 1);
    assert.deepEqual(await listGroups(orgId, inv), [
      { name: "Fasteners", count: 1 },
      { name: "Hardware", count: 1 },
    ]);

    const byCode = await resolveCode(orgId, inv, item.code!.toLowerCase().replace(/^(....)/, "$1-"));
    assert.equal(byCode[0]?.kind, "item");
    const byLoc = await resolveCode(orgId, inv, tree.get(box)!.code!);
    assert.equal(byLoc[0]?.kind, "location");
    assert.equal((await resolveCode(orgId, inv, "4006381333931"))[0]?.id, screws);
    assert.equal((await resolveCode(orgId, inv, "unknown")).length, 0);

    const summary = await inventorySummary(orgId, inv);
    assert.equal(summary.items, 2);
    assert.equal(summary.lowStock, 1);
    assert.equal(summary.locations, 3);
    assert.equal(summary.unplaced, 1);

    const csv = await exportItemsCsv(orgId, inv);
    assert.match(csv, /M4 screws/);
    const dry = await importItemsCsv(orgId, inv, csv, { dryRun: true, actor });
    assert.equal(dry.total, 2);
    assert.equal(dry.mapping["Title"], "title");
    const reimport = await importItemsCsv(orgId, inv, csv, { actor });
    assert.equal(reimport.updated, 2);
    assert.deepEqual(reimport.errors, []);
    const fresh = await importItemsCsv(
      orgId,
      inv,
      'Name,Qty,Location,Category\r\n"Wire, 2mm",12,Warehouse B > Shelf 1,"Electrical; Cable"\r\nBroken,abc,,\r\n',
      { actor },
    );
    assert.equal(fresh.created, 1);
    assert.equal(fresh.locationsCreated, 2);
    assert.equal(fresh.errors.length, 1);
    assert.equal(fresh.errors[0].row, 3);

    assert.equal((await labelData(orgId, inv, "location")).length, 5);
    assert.equal((await labelData(orgId, inv, "item", [screws])).length, 1);

    const log = await readLog(orgId, inv, { target: screws });
    assert.deepEqual(log.map((l) => l.action).sort(), ["created", "imported", "quantity", "quantity"]);
    assert.equal(log.find((l) => l.reason === "used")?.delta, -15);

    const logDb = (await getNode(orgId, inv.log, { includeDeleted: true }))!;
    assert.equal(hooksFor(logDb)?.rowsReadOnly, true);

    console.log("inventory smoke: ok");
  } finally {
    await db.deleteFrom("note_node").where("organizationId", "=", orgId).execute();
    await db.deleteFrom("server_setting").where("key", "=", `inventories:${orgId}`).execute();
    await db.deleteFrom("organization").where("id", "=", orgId).execute();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
