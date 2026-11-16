import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { matchGlob, resolveRequest, headersFor, type FileEntry } from "./match.js";
import { extractZip } from "./zip.js";
import { normalizeFilePath } from "./paths.js";
import { createAdminHostCheck as createAdminHostCheckForTest } from "./serve.js";

const f = (p: string, ct = "text/html"): [string, FileEntry] => [p, { path: p, sha256: p.replace(/\W/g, "").padEnd(64, "0"), size: 1, contentType: ct }];
const files = new Map<string, FileEntry>([f("index.html"), f("about.html"), f("docs/index.html"), f("app.js", "text/javascript"), f("404.html"), f("img/logo.png", "image/png")]);

test("globs", () => {
  assert.deepEqual(matchGlob("/blog/:slug", "/blog/hello"), { slug: "hello" });
  assert.equal(matchGlob("/blog/:slug", "/blog/a/b"), null);
  assert.ok(matchGlob("**", "/any/depth/x.js"));
  assert.ok(matchGlob("/**/*.png", "/a/b/c.png"));
  assert.ok(matchGlob("/**/*.png", "/c.png"));
  assert.equal(matchGlob("/*.png", "/a/c.png"), null);
  assert.ok(matchGlob("/x.{js,css}", "/x.css"));
  assert.equal(matchGlob("/a.b", "/aXb"), null);
});

test("static files, index, 404", () => {
  assert.equal((resolveRequest("/", files, {}) as any).file.path, "index.html");
  assert.equal((resolveRequest("/docs/", files, {}) as any).file.path, "docs/index.html");
  assert.equal((resolveRequest("/docs", files, {}) as any).file.path, "docs/index.html");
  assert.equal((resolveRequest("/about", files, {}) as any).status, 404, "no cleanUrls -> /about is not about.html");
  const nf = resolveRequest("/nope", files, {}) as any;
  assert.equal(nf.status, 404);
  assert.equal(nf.file.path, "404.html");
  assert.equal(resolveRequest("/nope", new Map([f("index.html")]), {}).kind, "notfound");
});

test("cleanUrls + trailingSlash", () => {
  const c = { cleanUrls: true };
  assert.equal((resolveRequest("/about", files, c) as any).file.path, "about.html");
  assert.deepEqual(resolveRequest("/about.html", files, c), { kind: "redirect", location: "/about", status: 301 });
  assert.deepEqual(resolveRequest("/docs/index.html", files, c), { kind: "redirect", location: "/docs/", status: 301 });
  assert.deepEqual(resolveRequest("/docs", files, { trailingSlash: true }), { kind: "redirect", location: "/docs/", status: 301 });
  assert.deepEqual(resolveRequest("/docs/", files, { trailingSlash: false }), { kind: "redirect", location: "/docs", status: 301 });
});

test("SPA rewrite: files win, everything else -> index.html", () => {
  const c = { spa: true };
  assert.equal((resolveRequest("/app.js", files, c) as any).file.path, "app.js");
  const r = resolveRequest("/users/42/settings", files, c) as any;
  assert.equal(r.status, 200);
  assert.equal(r.file.path, "index.html");
});

test("explicit rewrites, redirects with params, order", () => {
  const c = {
    redirects: [{ source: "/old/:slug", destination: "/new/:slug", type: 302 as const }, { source: "/ext", destination: "https://example.com/x" }, { source: "/bad", destination: "//evil.com" }, { source: "/js", destination: "javascript:alert(1)" }],
    rewrites: [{ source: "/app/**", destination: "/index.html" }, { source: "/missing/**", destination: "/does-not-exist.html" }],
  };
  assert.deepEqual(resolveRequest("/old/x", files, c), { kind: "redirect", location: "/new/x", status: 302 });
  assert.deepEqual(resolveRequest("/ext", files, c), { kind: "redirect", location: "https://example.com/x", status: 301 });
  assert.notEqual((resolveRequest("/bad", files, c) as any).kind, "redirect", "protocol-relative redirect is refused");
  assert.notEqual((resolveRequest("/js", files, c) as any).kind, "redirect", "javascript: redirect is refused");
  assert.equal((resolveRequest("/app/deep/link", files, c) as any).file.path, "index.html");
  assert.equal((resolveRequest("/missing/x", files, c) as any).status, 404);
  // a redirect beats an existing file
  assert.equal(resolveRequest("/index.html", files, { redirects: [{ source: "/index.html", destination: "/" }] }).kind, "redirect");
});

test("header rules", () => {
  const c = { headers: [{ source: "**", headers: [{ key: "X-A", value: "1" }] }, { source: "/**/*.js", headers: [{ key: "Cache-Control", value: "immutable" }, { key: "X-A", value: "2" }] }] };
  assert.deepEqual(headersFor("/a/b.js", c), { "x-a": "2", "cache-control": "immutable" });
  assert.deepEqual(headersFor("/a.html", c), { "x-a": "1" });
});

test("path normalization", () => {
  assert.equal(normalizeFilePath("/a/b.html"), "a/b.html");
  for (const bad of ["", "../x", "a/../b", "a//b", "a\\b", "a/./b"]) assert.throws(() => normalizeFilePath(bad), bad);
});

test("zip: strips wrapper folder, skips junk, enforces limits", () => {
  const lim = { maxFiles: 10, maxFileBytes: 1000, maxTotalBytes: 5000 };
  const zip = zipSync({ "site/index.html": strToU8("<h1>hi</h1>"), "site/css/a.css": strToU8("a{}"), "__MACOSX/site/._index.html": strToU8("x"), "site/.DS_Store": strToU8("x") });
  const e = extractZip(Buffer.from(zip), lim);
  assert.deepEqual(e.map((x) => x.path).sort(), ["css/a.css", "index.html"]);
  const flat = extractZip(Buffer.from(zipSync({ "index.html": strToU8("x"), "a/b.txt": strToU8("y") })), lim);
  assert.deepEqual(flat.map((x) => x.path).sort(), ["a/b.txt", "index.html"]);
  assert.throws(() => extractZip(Buffer.from(zipSync({ "big.txt": new Uint8Array(2000) })), lim), /file limit/);
  assert.throws(() => extractZip(Buffer.from(zipSync({ "../evil.txt": strToU8("x") })), lim), /invalid/);
  assert.throws(() => extractZip(Buffer.from("not a zip"), lim), /could not read/);
  assert.throws(() => extractZip(Buffer.from(zipSync({ a: strToU8("1"), b: strToU8("1"), c: strToU8("1") })), { ...lim, maxFiles: 2 }), /more than 2/);
});

test("admin host detection", () => {
  const admin = createAdminHostCheckForTest("pager.example.com");
  for (const h of ["pager.example.com", "localhost", "127.0.0.1", "twodb", null, "x.localhost", "::1"]) assert.ok(admin(h), String(h));
  for (const h of ["landing.acme.com", "acme.io"]) assert.ok(!admin(h), h);
});
