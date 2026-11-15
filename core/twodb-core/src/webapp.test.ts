import { test } from "node:test";
import assert from "node:assert/strict";
import { webappRewriteUrl } from "./webapp.js";

const r = (url: string) => webappRewriteUrl({ url });

test("/api prefix is stripped", () => {
  assert.equal(r("/api/boards"), "/boards");
  assert.equal(r("/api/boards?x=1"), "/boards?x=1");
  assert.equal(r("/api"), "/");
  assert.equal(r("/api?x=1"), "/?x=1");
});
test("healthz and _svc stay un-prefixed", () => {
  assert.equal(r("/healthz"), "/healthz");
  assert.equal(r("/_svc/inbox"), "/_svc/inbox");
});
test("everything else is the SPA mount", () => {
  assert.equal(r("/"), "/__web/");
  assert.equal(r("/assets/a.js"), "/__web/assets/a.js");
  assert.equal(r("/boards"), "/__web/boards"); // old un-prefixed API paths no longer reach handlers
  assert.equal(r("/apix"), "/__web/apix");
});
