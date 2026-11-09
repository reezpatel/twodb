/** HTTP-level smoke test: inventory routes + the generic notes routes hooked
 *  into the locked-database registry. Run against a scratch database only:
 *    TWODB_DATABASE_URL=postgres://… tsx scripts/inventory-http-smoke.ts */
import assert from "node:assert/strict";
import { Hono } from "hono";
import { db } from "../src/auth";
import { generateApiKey } from "../src/lib/api-keys";
import { inventoryRoutes } from "../src/routes/inventory";
import { notesRoutes } from "../src/routes/notes";
import { notesContentRoutes } from "../src/routes/notes-content";

const orgId = `org_http_${Date.now()}`;
const userId = `usr_http_${Date.now()}`;
const { key, prefix, hash } = generateApiKey();

const app = new Hono();
app.route("/api/inventory", inventoryRoutes);
app.route("/api/notes", notesRoutes);
app.route("/api/notes", notesContentRoutes);

async function call(method: string, path: string, body?: unknown) {
  const res = await app.request(path, {
    method,
    headers: { "x-api-key": key, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // csv / empty
  }
  return { status: res.status, json, text };
}

async function main() {
  const now = new Date();
  await db.insertInto("organization").values({ id: orgId, name: "Http", slug: orgId, createdAt: now } as never).execute();
  await db.insertInto("user").values({ id: userId, name: "T", email: `${userId}@x.test`, emailVerified: true, createdAt: now, updatedAt: now } as never).execute();
  await db.insertInto("api_key").values({ id: `key_${userId}`, organizationId: orgId, userId, name: "t", prefix, hash, createdAt: now, updatedAt: now }).execute();
  try {
    assert.equal((await call("GET", "/api/inventory")).status, 200);
    const unauth = await app.request("/api/inventory");
    assert.equal(unauth.status, 401);

    const inv = (await call("POST", "/api/inventory", { name: "Garage" })).json;
    const base = `/api/inventory/${inv.id}`;

    const wh = (await call("POST", `/api/notes/databases/${inv.locations}/rows`, { title: "Warehouse", props: { kind: "warehouse" } })).json.noteId;
    const rack = (await call("POST", `/api/notes/databases/${inv.locations}/rows`, { title: "Rack 1", props: { parent: wh, kind: "rack" } })).json.noteId;
    assert.ok(wh && rack);

    const created = await call("POST", `/api/notes/databases/${inv.items}/rows`, { title: "Hammer", props: { quantity: 3, location: rack, groups: ["Tools"] } });
    assert.equal(created.status, 201);
    const itemId = created.json.noteId;
    let items = (await call("GET", `${base}/items`)).json.items;
    assert.equal(items.length, 1);
    assert.equal(items[0].locationPath, "Warehouse › Rack 1");
    assert.match(items[0].code, /^[0-9A-Z]{8}$/);

    assert.equal((await call("PATCH", `/api/notes/databases/${inv.items}/rows/${itemId}`, { props: { code: "AAAAAAAA" } })).json.error, "code_immutable");
    assert.equal((await call("PATCH", `/api/notes/databases/${inv.items}/rows/${itemId}`, { props: { quantity: -4 } })).status, 400);
    assert.equal((await call("PATCH", `/api/notes/databases/${inv.items}/rows/${itemId}`, { props: { quantity: 5 } })).status, 200);
    assert.equal((await call("PATCH", `/api/notes/databases/${inv.items}/rows/${itemId}`, { props: { location: "ghost" } })).status, 400);
    assert.equal((await call("POST", `/api/notes/databases/${inv.items}/properties`, { name: "X", type: "text" })).status, 403);
    assert.equal((await call("POST", `/api/notes/databases/${inv.items}/properties`, { name: "X", type: "relation" })).status, 403);

    const renamed = await call("PATCH", `/api/notes/nodes/${wh}`, { title: "Main Warehouse" });
    assert.equal(renamed.status, 200);
    items = (await call("GET", `${base}/items`)).json.items;
    assert.equal(items[0].locationPath, "Main Warehouse › Rack 1");

    const blocked = await call("DELETE", `/api/notes/nodes/${rack}`);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.json.error, "location_not_empty");
    assert.equal((await call("DELETE", `/api/notes/databases/${inv.locations}/rows/${wh}`)).status, 409);
    assert.equal((await call("PATCH", `/api/notes/nodes/${rack}`, { parentId: wh })).status, 403);

    const adj = await call("POST", `${base}/items/${itemId}/adjust`, { delta: -2, reason: "sold" });
    assert.deepEqual(adj.json, { quantity: 3, previous: 5 });
    assert.equal((await call("POST", `${base}/items/${itemId}/adjust`, { delta: -50 })).status, 409);
    assert.equal((await call("POST", `${base}/items/${itemId}/move`, { locationId: null })).status, 200);

    const code = items[0].code;
    const resolved = await call("GET", `${base}/resolve?code=${code}`);
    assert.equal(resolved.json.matches[0].item.title, "Hammer");
    assert.equal((await call("GET", `${base}/locations`)).json.locations.length, 2);
    assert.equal((await call("GET", `${base}/groups`)).json.groups[0].name, "Tools");
    assert.equal((await call("GET", `${base}/summary`)).json.items, 1);
    assert.equal((await call("GET", `${base}/labels?kind=location`)).json.labels.length, 2);

    const csv = await call("GET", `${base}/export.csv`);
    assert.match(csv.text, /Hammer/);
    const imp = await call("POST", `${base}/import`, { csv: "Name,Qty\nNails,100\n" });
    assert.equal(imp.json.created, 1);

    const log = (await call("GET", `${base}/log?target=${itemId}`)).json.entries;
    const actions = log.map((l: any) => l.action).sort();
    assert.ok(actions.includes("created") && actions.includes("moved") && actions.filter((a: string) => a === "quantity").length === 2);

    const logRow = (await call("GET", `${base}/log?limit=1`)).json.entries[0];
    assert.equal((await call("POST", `/api/notes/databases/${inv.log}/rows`, { title: "x" })).json.error, "rows_read_only");
    assert.equal((await call("PATCH", `/api/notes/databases/${inv.log}/rows/${logRow.id}`, { title: "x" })).status, 403);
    assert.equal((await call("DELETE", `/api/notes/nodes/${logRow.id}`)).status, 403);
    assert.equal((await call("PATCH", `/api/notes/nodes/${logRow.id}`, { title: "tamper" })).status, 403);

    assert.equal((await call("DELETE", `/api/notes/nodes/${itemId}`)).status, 200);
    assert.equal((await call("GET", `${base}/items`)).json.items.length, 1);
    assert.equal((await call("POST", `/api/notes/nodes/${itemId}/restore`)).status, 200);
    assert.equal((await call("GET", `${base}/items`)).json.items.length, 2);
    assert.equal((await call("GET", `${base}/log?target=${itemId}`)).json.entries.filter((l: any) => l.action === "deleted" || l.action === "restored").length, 2);

    assert.equal((await call("GET", "/api/inventory/nope/items")).status, 404);
    console.log("inventory http smoke: ok");
  } finally {
    await db.deleteFrom("note_node").where("organizationId", "=", orgId).execute();
    await db.deleteFrom("server_setting").where("key", "=", `inventories:${orgId}`).execute();
    await db.deleteFrom("api_key").where("organizationId", "=", orgId).execute();
    await db.deleteFrom("organization").where("id", "=", orgId).execute();
    await db.deleteFrom("user").where("id", "=", userId).execute();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
