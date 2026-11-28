// End-to-end check against a disposable Postgres: API (versions, zip, rollback, isolation) + host-based serving.
//   TEST_DATABASE_URL=postgres://... tsx scripts/smoke.ts
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { zipSync, strToU8 } from "fflate";
import { createPgDb, sql } from "@twodb/core-data/db";
import { createLocalStorage } from "@twodb/core-data/storage";
import { withKeyPrefix } from "@twodb/twodb-core";
import { loadTwoPagerConfig } from "../src/config.js";
import { buildServer } from "../src/server.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL must point to a disposable Postgres database");

// In production the control plane provisions the `twopager` schema + role; here we create a fresh one.
const admin = createPgDb<any>({ connectionString: databaseUrl, schema: "public" });
await sql`drop schema if exists twopager cascade`.execute(admin);
await sql`create schema twopager`.execute(admin);

const tmp = mkdtempSync(path.join(tmpdir(), "twopager-"));
const config = { ...loadTwoPagerConfig({ DATABASE_URL: databaseUrl, CACHE_DIR: path.join(tmp, "cache"), ADMIN_HOSTS: "pager.example.com", SITES_DOMAIN: "pages.example.com" }) };
// Production gets a prefix-scoped S3 adapter from the control plane; the smoke test uses local disk.
const storage = withKeyPrefix(createLocalStorage({ rootDir: path.join(tmp, "blobs") }), "twopager/");
const app = await buildServer(config, { storage });

const as = (workspaceId: string, spaceIds = "") => ({ "x-twodb-auth-kind": "apiKey", "x-twodb-workspace-id": workspaceId, ...(spaceIds ? { "x-twodb-space-ids": spaceIds } : {}) });
const ws1 = as("w1");
const call = async (method: string, url: string, headers: Record<string, string>, payload?: unknown, contentType?: string) => {
  const r = await app.inject({ method: method as any, url: `/api${url}`, headers: { ...headers, ...(contentType ? { "content-type": contentType } : {}) }, payload: payload as any });
  return { status: r.statusCode, body: r.body ? (r.headers["content-type"]?.toString().includes("json") ? r.json() : r.body) : null };
};
const web = (host: string, url = "/", headers: Record<string, string> = {}, method = "GET") => app.inject({ method: method as any, url, headers: { host, ...headers } });

try {
  assert.equal((await app.inject({ url: "/api/sites?spaceId=s1" })).statusCode, 401);

  // sites
  const site = (await call("POST", "/sites", ws1, { spaceId: "s1", name: "Acme Landing", domains: ["Landing.Acme.com"] })).body;
  assert.equal(site.slug, "acme-landing");
  assert.deepEqual(site.domains, ["landing.acme.com"]);
  assert.deepEqual(site.hosts, ["acme-landing.pages.example.com", "landing.acme.com"]);
  assert.equal((await call("POST", "/sites", ws1, { spaceId: "s1", name: "x", slug: "other", domains: ["landing.acme.com"] })).status, 409, "domain is unique");
  assert.equal((await call("POST", "/sites", ws1, { spaceId: "s1", name: "x", domains: ["pager.example.com"] })).status, 400, "admin host reserved");
  assert.equal((await call("POST", "/sites", as("w1", "s9"), { spaceId: "s1", name: "no" })).status, 403, "space restriction");
  assert.equal((await call("GET", `/sites/${site.id}`, as("w2"))).status, 404, "workspace isolation");
  assert.equal((await call("GET", "/sites?spaceId=s1", ws1)).body.length, 1);

  // nothing published yet
  assert.equal((await web("landing.acme.com")).statusCode, 404);

  // v1: draft -> files -> config -> finalize + activate
  const v1 = (await call("POST", `/sites/${site.id}/versions`, ws1, { message: "first" })).body;
  assert.equal(v1.number, 1);
  assert.equal(v1.status, "draft");
  const put = await call("PUT", `/sites/${site.id}/versions/${v1.id}/files`, ws1, {
    files: [
      { path: "index.html", content: "<h1>v1 home</h1>" },
      { path: "assets/app.js", content: "console.log(1)" },
      { path: "assets/logo.bin", contentBase64: Buffer.from([1, 2, 3, 4]).toString("base64") },
      { path: "twopager.json", content: JSON.stringify({ spa: true }) },
    ],
  });
  assert.equal(put.status, 200);
  assert.equal(put.body.written, 4);
  const draft = (await call("GET", `/sites/${site.id}/versions/${v1.id}`, ws1)).body;
  assert.equal(draft.fileCount, 3, "twopager.json is config, not a file");
  assert.deepEqual(draft.config, { spa: true });
  assert.equal((await web("landing.acme.com")).statusCode, 404, "drafts are not served");
  assert.equal((await call("POST", `/sites/${site.id}/activate`, ws1, { versionId: v1.id })).status, 409, "draft cannot be activated");
  assert.equal((await call("POST", `/sites/${site.id}/versions/${v1.id}/finalize`, ws1, { activate: true })).body.active, true);
  assert.equal((await call("PUT", `/sites/${site.id}/versions/${v1.id}/files`, ws1, { files: [{ path: "x.html", content: "x" }] })).status, 409, "final versions are immutable");

  // serving
  let r = await web("landing.acme.com");
  assert.equal(r.statusCode, 200);
  assert.equal(r.body, "<h1>v1 home</h1>");
  assert.match(String(r.headers["content-type"]), /text\/html/);
  assert.equal(r.headers["x-twopager-version"], "1");
  assert.equal((await web("landing.acme.com", "/some/spa/route")).body, "<h1>v1 home</h1>", "SPA fallback");
  assert.equal((await web("landing.acme.com:6400", "/")).statusCode, 200, "port in Host is ignored");
  assert.equal((await web("acme-landing.pages.example.com")).statusCode, 200, "built-in subdomain");
  assert.equal((await web("internal.example.com", "/", { "x-forwarded-host": "landing.acme.com" })).statusCode, 200, "gateway x-forwarded-host wins");
  r = await web("landing.acme.com", "/assets/app.js");
  assert.match(String(r.headers["content-type"]), /javascript/);
  const etag = String(r.headers.etag);
  assert.equal((await web("landing.acme.com", "/assets/app.js", { "if-none-match": etag })).statusCode, 304);
  assert.equal((await web("landing.acme.com", "/assets/logo.bin")).rawPayload.length, 4);
  assert.equal((await web("landing.acme.com", "/", {}, "HEAD")).statusCode, 200);
  assert.equal((await web("landing.acme.com", "/", {}, "POST")).statusCode, 405);
  assert.equal((await web("nobody.example.org")).statusCode, 404, "unknown host");
  assert.notEqual((await web("pager.example.com")).body, "<h1>v1 home</h1>", "admin host never serves a site");
  assert.notEqual((await web("localhost")).body, "<h1>v1 home</h1>");
  assert.ok(readdirSync(path.join(tmp, "cache")).length > 0, "files were cached locally");

  // publishPage: add a page on top of the live version (v2), v1 untouched
  const v2 = (await call("POST", `/sites/${site.id}/pages`, ws1, { pages: [{ path: "pricing/index.html", content: "<h1>pricing</h1>" }], message: "add pricing" })).body;
  assert.equal(v2.number, 2);
  assert.equal(v2.active, true);
  assert.equal(v2.fileCount, 4);
  assert.deepEqual(v2.config, { spa: true }, "config carried over");
  assert.equal((await web("landing.acme.com", "/pricing/")).body, "<h1>pricing</h1>");
  assert.equal((await web("landing.acme.com")).body, "<h1>v1 home</h1>");
  const list = (await call("GET", `/sites/${site.id}/versions`, ws1)).body;
  assert.deepEqual(list.map((v: any) => [v.number, v.active]), [[2, true], [1, false]]);
  assert.equal((await call("DELETE", `/sites/${site.id}/versions/${v2.id}`, ws1)).status, 409, "active version is protected");

  // rollback
  await call("POST", `/sites/${site.id}/activate`, ws1, { versionId: v1.id });
  assert.equal((await web("landing.acme.com", "/pricing/")).body, "<h1>v1 home</h1>", "v1 has no /pricing -> SPA fallback");
  assert.equal((await web("landing.acme.com")).headers["x-twopager-version"], "1");
  const file = (await call("GET", `/sites/${site.id}/versions/${v2.id}/file?path=pricing/index.html`, ws1)).body;
  assert.equal(file.content, "<h1>pricing</h1>");
  assert.equal((await call("GET", `/sites/${site.id}/versions/${v1.id}/file?path=assets/logo.bin`, ws1)).body.encoding, "base64");

  // zip: full snapshot with wrapper folder + config
  const zip = zipSync({
    "dist/index.html": strToU8("<h1>zip home</h1>"),
    "dist/about.html": strToU8("<h1>about</h1>"),
    "dist/404.html": strToU8("<h1>gone</h1>"),
    "dist/twopager.json": strToU8(JSON.stringify({ cleanUrls: true, redirects: [{ source: "/old", destination: "/about", type: 302 }], headers: [{ source: "**", headers: [{ key: "X-Frame-Options", value: "DENY" }] }] })),
  });
  const up = await call("POST", `/sites/${site.id}/versions/zip?message=zip%20deploy`, ws1, Buffer.from(zip), "application/zip");
  assert.equal(up.status, 200, JSON.stringify(up.body));
  assert.equal(up.body.number, 3);
  assert.equal(up.body.active, true);
  assert.equal(up.body.fileCount, 3);
  assert.equal((await web("landing.acme.com")).body, "<h1>zip home</h1>");
  assert.equal((await web("landing.acme.com", "/about")).body, "<h1>about</h1>", "clean URL");
  assert.equal((await web("landing.acme.com", "/about.html")).headers.location, "/about");
  const old = await web("landing.acme.com", "/old");
  assert.equal(old.statusCode, 302);
  assert.equal(old.headers.location, "/about");
  const missing = await web("landing.acme.com", "/nope");
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.body, "<h1>gone</h1>");
  assert.equal(missing.headers["x-frame-options"], "DENY");
  // JSON/base64 variant + bad zip
  const up2 = await call("POST", `/sites/${site.id}/versions/zip`, ws1, { zipBase64: Buffer.from(zip).toString("base64"), activate: false });
  assert.equal(up2.status, 200);
  assert.equal(up2.body.active, false);
  assert.equal((await call("POST", `/sites/${site.id}/versions/zip`, ws1, Buffer.from("garbage"), "application/zip")).status, 400);
  assert.equal((await call("GET", `/sites/${site.id}/versions`, ws1)).body.length, 4, "failed upload leaves no stray draft");

  // deleting a version keeps blobs other versions still use; removing the last user deletes them
  assert.equal((await call("DELETE", `/sites/${site.id}/versions/${up2.body.id}`, ws1)).status, 200);
  assert.equal((await web("landing.acme.com", "/about")).body, "<h1>about</h1>");

  // domains
  assert.equal((await call("POST", `/sites/${site.id}/domains`, ws1, { host: "www.acme.com" })).status, 200);
  assert.equal((await web("www.acme.com")).statusCode, 200);
  assert.equal((await call("DELETE", `/sites/${site.id}/domains/www.acme.com`, ws1)).status, 200);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal((await web("www.acme.com")).statusCode, 404, "detached domain stops serving immediately");

  // delete site
  assert.equal((await call("DELETE", `/sites/${site.id}`, ws1)).status, 200);
  assert.equal((await web("landing.acme.com")).statusCode, 404);
  assert.equal((await call("GET", "/sites?spaceId=s1", ws1)).body.length, 0);

  console.log("PASS: sites, versions, drafts/immutability, publishPage, rollback, zip, SPA/clean-URL/redirect/header rules, host routing, cache, isolation");
} finally {
  await app.close();
  await admin.destroy();
}
